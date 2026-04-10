import express from 'express';
import cors from 'cors';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import config from './config.js';
import { auth } from './middleware/auth.js';
import { resolveTenant } from './middleware/tenant.js';
import { run, get, query } from './database.js';
import { normalizePhone } from './services/whatsapp.js';

// Routes
import authRoutes from './routes/auth.js';
import whatsappRoutes from './routes/whatsapp.js';
import whatsappChatRoutes from './routes/whatsapp-chat.js';
import contactsRoutes from './routes/contacts.js';
import tenantSettingsRoutes from './routes/tenant-settings.js';
import leadsRoutes from './routes/leads.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use(cors({
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-slug'],
}));

// Health check
app.get('/health', (req, res) => res.json({ status: 'healthy' }));
app.get('/', (req, res) => res.json({ message: 'WhatsApp Marketing Platform API' }));

// ============================================================
// WhatsApp Webhook — Public endpoint (no tenant/auth needed)
// Handles BOTH delivery statuses AND incoming messages
// ============================================================
app.get('/api/v1/whatsapp-webhook', (req, res) => {
    const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "CrmSaasWebhookToken123";

    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token) {
        if (mode === "subscribe" && token === VERIFY_TOKEN) {
            console.log("✅ Webhook Verified by Meta");
            res.status(200).send(challenge);
        } else {
            console.warn("⚠️ Webhook Verification Failed");
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(400);
    }
});

app.post('/api/v1/whatsapp-webhook', async (req, res) => {
    try {
        const body = req.body;

        if (body.object === "whatsapp_business_account") {
            for (const entry of (body.entry || [])) {
                for (const change of (entry.changes || [])) {
                    const value = change.value;
                    const phoneNumberId = value?.metadata?.phone_number_id;

                    // ---- DELIVERY STATUS UPDATES ----
                    if (value?.statuses) {
                        for (const status of value.statuses) {
                            const messageId = status.id;
                            const currentStatus = status.status;
                            const timestamp = new Date(parseInt(status.timestamp) * 1000)
                                .toISOString().slice(0, 19).replace('T', ' ');

                            let errorDetail = null;
                            if (status.errors) {
                                errorDetail = status.errors.map(err =>
                                    `${err.title}: ${err.error_data?.details || err.message}`
                                ).join(' | ');
                            }

                            try {
                                // Update broadcast message log
                                if (currentStatus === 'delivered') {
                                    await run('UPDATE whatsapp_messages SET status = ?, delivered_at = ? WHERE provider_message_id = ?', ['delivered', timestamp, messageId]);
                                } else if (currentStatus === 'read') {
                                    await run('UPDATE whatsapp_messages SET status = ?, read_at = ? WHERE provider_message_id = ?', ['read', timestamp, messageId]);
                                } else if (currentStatus === 'failed') {
                                    await run('UPDATE whatsapp_messages SET status = ?, error_message = ? WHERE provider_message_id = ?', ['failed', errorDetail || 'Unknown failure', messageId]);
                                } else {
                                    await run('UPDATE whatsapp_messages SET status = ? WHERE provider_message_id = ?', [currentStatus, messageId]);
                                }

                                // Also update chat message status
                                if (currentStatus === 'delivered') {
                                    await run('UPDATE whatsapp_chat_messages SET status = ? WHERE provider_message_id = ? AND status != ?', ['delivered', messageId, 'read']);
                                } else if (currentStatus === 'read') {
                                    await run('UPDATE whatsapp_chat_messages SET status = ? WHERE provider_message_id = ?', ['read', messageId]);
                                } else if (currentStatus === 'failed') {
                                    await run('UPDATE whatsapp_chat_messages SET status = ?, error_message = ? WHERE provider_message_id = ?', ['failed', errorDetail || 'Unknown failure', messageId]);
                                }
                            } catch (dbErr) {
                                console.error('Webhook DB update error:', dbErr.message);
                            }
                        }
                    }

                    // ---- INCOMING MESSAGES (NEW — Chat Inbox) ----
                    if (value?.messages) {
                        for (const msg of value.messages) {
                            try {
                                await processIncomingMessage(msg, value.contacts, phoneNumberId);
                            } catch (err) {
                                console.error('[Webhook] Error processing incoming message:', err.message);
                            }
                        }
                    }
                }
            }
            res.sendStatus(200);
        } else {
            res.sendStatus(404);
        }
    } catch (error) {
        console.error("Webhook processing error:", error);
        res.sendStatus(500);
    }
});

/**
 * Process an incoming WhatsApp message and store it in the chat system
 */
async function processIncomingMessage(msg, contacts, phoneNumberId) {
    const fromPhone = normalizePhone(msg.from);
    if (!fromPhone) return;

    const senderProfile = contacts?.[0]?.profile?.name || null;

    // Find the tenant by their phone_number_id
    const tenant = await get(
        'SELECT id FROM tenants WHERE whatsapp_phone_number_id = ? AND whatsapp_configured = TRUE',
        [phoneNumberId]
    );
    if (!tenant) {
        console.log(`[Webhook] No tenant found for phone_number_id: ${phoneNumberId}`);
        return;
    }
    const tenantId = tenant.id;

    // Find or create conversation
    let conversation = await get(
        'SELECT * FROM whatsapp_conversations WHERE tenant_id = ? AND phone = ?',
        [tenantId, fromPhone]
    );

    // Try to match phone to a contact
    let contactId = conversation?.contact_id || null;
    let contactName = senderProfile || conversation?.contact_name || fromPhone;

    if (!contactId) {
        const contact = await get(
            'SELECT id, name FROM contacts WHERE tenant_id = ? AND phone LIKE ?',
            [tenantId, `%${fromPhone.slice(-10)}`]
        );
        if (contact) {
            contactId = contact.id;
            contactName = contact.name;
        }
    }

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const windowExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

    // Extract message content
    let messageType = msg.type || 'text';
    let body = null;
    let mediaId = null;
    let mediaMime = null;

    if (msg.type === 'text') {
        body = msg.text?.body || '';
    } else if (msg.type === 'image') {
        body = msg.image?.caption || '';
        mediaId = msg.image?.id;
        mediaMime = msg.image?.mime_type;
    } else if (msg.type === 'video') {
        body = msg.video?.caption || '';
        mediaId = msg.video?.id;
        mediaMime = msg.video?.mime_type;
    } else if (msg.type === 'document') {
        body = msg.document?.filename || 'Document';
        mediaId = msg.document?.id;
        mediaMime = msg.document?.mime_type;
    } else if (msg.type === 'audio') {
        body = '🎵 Audio message';
        mediaId = msg.audio?.id;
        mediaMime = msg.audio?.mime_type;
    } else if (msg.type === 'reaction') {
        body = msg.reaction?.emoji || '👍';
        messageType = 'reaction';
    } else if (msg.type === 'sticker') {
        body = '🏷️ Sticker';
        mediaId = msg.sticker?.id;
        mediaMime = msg.sticker?.mime_type;
    } else {
        body = `[${msg.type}]`;
    }

    const previewText = (body || '').substring(0, 100);

    if (!conversation) {
        // Create new conversation
        const result = await run(
            `INSERT INTO whatsapp_conversations (tenant_id, phone, contact_name, contact_id, last_message_text, last_message_at, last_customer_message_at, window_expires_at, unread_count)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [tenantId, fromPhone, contactName, contactId, previewText, now, now, windowExpiry]
        );
        conversation = { id: result.lastInsertRowid };
    } else {
        // Update existing conversation
        await run(
            `UPDATE whatsapp_conversations
             SET contact_name = COALESCE(?, contact_name), contact_id = COALESCE(?, contact_id),
                 last_message_text = ?, last_message_at = ?,
                 last_customer_message_at = ?, window_expires_at = ?,
                 unread_count = unread_count + 1, is_archived = FALSE
             WHERE id = ?`,
            [contactName, contactId, previewText, now, now, windowExpiry, conversation.id]
        );
    }

    // Insert chat message
    await run(
        `INSERT INTO whatsapp_chat_messages (tenant_id, conversation_id, direction, message_type, body, media_id, media_mime_type, provider_message_id, status)
         VALUES (?, ?, 'inbound', ?, ?, ?, ?, ?, 'delivered')`,
        [tenantId, conversation.id, messageType, body, mediaId, mediaMime, msg.id]
    );

    console.log(`[Chat] Incoming from ${fromPhone}: "${previewText}" (tenant: ${tenantId})`);
}

// Public lead capture (no tenant/auth needed)
app.use('/api/v1/leads', leadsRoutes);

// ============================================================
// TENANT-SCOPED API ROUTES
// ============================================================
app.use('/api/v1', resolveTenant);

// Auth (tenant resolved, auth not required for login)
app.use('/api/v1/auth', authRoutes);

// Protected routes
app.use('/api/v1/contacts', auth, contactsRoutes);
app.use('/api/v1/whatsapp', auth, whatsappRoutes);
app.use('/api/v1/whatsapp/chat', auth, whatsappChatRoutes);
app.use('/api/v1/tenant-settings', auth, tenantSettingsRoutes);

// Serve static frontend
const staticDir = join(__dirname, '..', 'public');
if (existsSync(staticDir)) {
    app.use(express.static(staticDir));
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) {
            res.sendFile(join(staticDir, 'index.html'));
        }
    });
}

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

export default app;
