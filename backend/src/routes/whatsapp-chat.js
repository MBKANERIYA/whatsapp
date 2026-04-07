import { Router } from 'express';
import { query, run, get } from '../database.js';
import { sendTextMessage, sendMediaMessage, normalizePhone } from '../services/whatsapp.js';
import { checkWhatsAppEnabled } from '../middleware/limits.js';

const router = Router();

// Admin-only + WhatsApp enabled
router.use((req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
});
router.use(checkWhatsAppEnabled);

/**
 * GET /api/v1/whatsapp/chat/conversations
 * List all conversations for this tenant
 */
router.get('/conversations', async (req, res) => {
    try {
        const { search, archived = '0', page = 1, limit = 30 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let sql = `SELECT wc.*, c.name as matched_contact_name, c.email as matched_contact_email
                    FROM whatsapp_conversations wc
                    LEFT JOIN contacts c ON wc.contact_id = c.id
                    WHERE wc.tenant_id = ? AND wc.is_archived = ?`;
        const params = [req.tenantId, archived === '1'];

        if (search) {
            sql += ' AND (wc.contact_name LIKE ? OR wc.phone LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        sql += ' ORDER BY wc.last_message_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const conversations = await query(sql, params);

        // Total unread count
        const unreadResult = await get(
            'SELECT SUM(unread_count) as total_unread FROM whatsapp_conversations WHERE tenant_id = ? AND is_archived = FALSE',
            [req.tenantId]
        );

        res.json({
            conversations: conversations.map(conv => ({
                ...conv,
                display_name: conv.matched_contact_name || conv.contact_name || conv.phone,
                is_window_open: conv.window_expires_at ? new Date(conv.window_expires_at) > new Date() : false,
                window_remaining_minutes: conv.window_expires_at
                    ? Math.max(0, Math.round((new Date(conv.window_expires_at) - new Date()) / 60000))
                    : 0,
            })),
            total_unread: unreadResult?.total_unread || 0,
        });
    } catch (error) {
        console.error('Fetch conversations error:', error);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
});

/**
 * GET /api/v1/whatsapp/chat/conversations/:id/messages
 * Get messages for a conversation
 */
router.get('/conversations/:id/messages', async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const conversation = await get(
            'SELECT * FROM whatsapp_conversations WHERE id = ? AND tenant_id = ?',
            [req.params.id, req.tenantId]
        );
        if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

        const messages = await query(
            `SELECT wcm.*, u.name as sender_name
             FROM whatsapp_chat_messages wcm
             LEFT JOIN users u ON wcm.sent_by = u.id
             WHERE wcm.conversation_id = ? AND wcm.tenant_id = ?
             ORDER BY wcm.created_at ASC
             LIMIT ? OFFSET ?`,
            [req.params.id, req.tenantId, parseInt(limit), offset]
        );

        const total = await get(
            'SELECT COUNT(*) as count FROM whatsapp_chat_messages WHERE conversation_id = ? AND tenant_id = ?',
            [req.params.id, req.tenantId]
        );

        res.json({
            conversation: {
                ...conversation,
                is_window_open: conversation.window_expires_at ? new Date(conversation.window_expires_at) > new Date() : false,
                window_remaining_minutes: conversation.window_expires_at
                    ? Math.max(0, Math.round((new Date(conversation.window_expires_at) - new Date()) / 60000))
                    : 0,
            },
            messages,
            total: total?.count || 0,
        });
    } catch (error) {
        console.error('Fetch messages error:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

/**
 * POST /api/v1/whatsapp/chat/conversations/:id/send
 * Send a free-form text reply (within 24h window)
 */
router.post('/conversations/:id/send', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text || !text.trim()) return res.status(400).json({ error: 'Message text is required' });

        const conversation = await get(
            'SELECT * FROM whatsapp_conversations WHERE id = ? AND tenant_id = ?',
            [req.params.id, req.tenantId]
        );
        if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

        // Check 24h window
        const windowOpen = conversation.window_expires_at && new Date(conversation.window_expires_at) > new Date();
        if (!windowOpen) {
            return res.status(400).json({
                error: '24-hour messaging window has expired. Send a template message to re-engage.',
                window_expired: true,
            });
        }

        // Send via Meta API
        const result = await sendTextMessage(conversation.phone, text.trim(), req.tenant);

        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

        // Store outbound message
        await run(
            `INSERT INTO whatsapp_chat_messages (tenant_id, conversation_id, direction, message_type, body, provider_message_id, status, sent_by)
             VALUES (?, ?, 'outbound', 'text', ?, ?, 'sent', ?)`,
            [req.tenantId, conversation.id, text.trim(), result.messageId, req.user.userId]
        );

        // Update conversation
        await run(
            `UPDATE whatsapp_conversations SET last_message_text = ?, last_message_at = ? WHERE id = ?`,
            [text.trim().substring(0, 100), now, conversation.id]
        );

        res.json({ success: true, messageId: result.messageId });
    } catch (error) {
        console.error('Send chat message error:', error);
        res.status(500).json({ error: error.message || 'Failed to send message' });
    }
});

/**
 * POST /api/v1/whatsapp/chat/conversations/:id/send-template
 * Send a template message (when 24h window expired)
 */
router.post('/conversations/:id/send-template', async (req, res) => {
    try {
        const { templateName, templateParams = [], languageCode } = req.body;
        if (!templateName) return res.status(400).json({ error: 'Template name is required' });

        const conversation = await get(
            'SELECT * FROM whatsapp_conversations WHERE id = ? AND tenant_id = ?',
            [req.params.id, req.tenantId]
        );
        if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

        // Import sendTemplateMessage
        const { sendTemplateMessage } = await import('../services/whatsapp.js');

        const result = await sendTemplateMessage(
            conversation.phone, templateName, templateParams,
            conversation.contact_name || 'Customer', languageCode, req.tenant
        );

        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

        await run(
            `INSERT INTO whatsapp_chat_messages (tenant_id, conversation_id, direction, message_type, body, provider_message_id, status, sent_by)
             VALUES (?, ?, 'outbound', 'template', ?, ?, 'sent', ?)`,
            [req.tenantId, conversation.id, `[Template: ${templateName}]`, result.messageId, req.user.userId]
        );

        await run(
            `UPDATE whatsapp_conversations SET last_message_text = ?, last_message_at = ? WHERE id = ?`,
            [`[Template: ${templateName}]`, now, conversation.id]
        );

        res.json({ success: true, messageId: result.messageId });
    } catch (error) {
        console.error('Send template in chat error:', error);
        res.status(500).json({ error: error.message || 'Failed to send template' });
    }
});

/**
 * PATCH /api/v1/whatsapp/chat/conversations/:id/read
 * Mark conversation as read
 */
router.patch('/conversations/:id/read', async (req, res) => {
    try {
        await run(
            'UPDATE whatsapp_conversations SET unread_count = 0 WHERE id = ? AND tenant_id = ?',
            [req.params.id, req.tenantId]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to mark as read' });
    }
});

/**
 * PATCH /api/v1/whatsapp/chat/conversations/:id/archive
 * Toggle archive status
 */
router.patch('/conversations/:id/archive', async (req, res) => {
    try {
        const conv = await get(
            'SELECT is_archived FROM whatsapp_conversations WHERE id = ? AND tenant_id = ?',
            [req.params.id, req.tenantId]
        );
        if (!conv) return res.status(404).json({ error: 'Not found' });

        await run(
            'UPDATE whatsapp_conversations SET is_archived = ? WHERE id = ? AND tenant_id = ?',
            [!conv.is_archived, req.params.id, req.tenantId]
        );
        res.json({ success: true, is_archived: !conv.is_archived });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update' });
    }
});

export default router;
