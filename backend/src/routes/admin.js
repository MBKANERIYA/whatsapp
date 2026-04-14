/**
 * Admin Routes — Super admin only (platform owners)
 * 
 * GET    /api/v1/admin/tenants          — List all tenants with stats
 * PUT    /api/v1/admin/tenants/:id       — Update tenant plan/status
 * PUT    /api/v1/admin/tenants/:id/suspend — Suspend/unsuspend
 * DELETE /api/v1/admin/tenants/:id       — Delete tenant + all data
 */
import { Router } from 'express';
import { query, run, get } from '../database.js';

const router = Router();

/**
 * GET /api/v1/admin/tenants
 * List all tenants with user count and contact count
 */
router.get('/tenants', async (req, res) => {
    try {
        const tenants = await query(`
            SELECT 
                t.*,
                (SELECT COUNT(*) FROM users WHERE tenant_id = t.id) AS user_count,
                (SELECT COUNT(*) FROM contacts WHERE tenant_id = t.id) AS contact_count
            FROM tenants t
            ORDER BY t.created_at DESC
        `);

        res.json({ tenants });
    } catch (error) {
        console.error('[ADMIN] List tenants error:', error.message);
        res.status(500).json({ error: 'Failed to list tenants' });
    }
});

/**
 * GET /api/v1/admin/tenants/:id/users
 * List users for a specific tenant
 */
router.get('/tenants/:id/users', async (req, res) => {
    try {
        const users = await query(
            'SELECT id, name, email, role, created_at, updated_at FROM users WHERE tenant_id = ?',
            [req.params.id]
        );
        res.json({ users });
    } catch (error) {
        console.error('[ADMIN] List users error:', error.message);
        res.status(500).json({ error: 'Failed to list users' });
    }
});

/**
 * PUT /api/v1/admin/tenants/:id
 * Update tenant subscription plan and status
 */
router.put('/tenants/:id', async (req, res) => {
    try {
        const { subscription_plan, subscription_status, max_users } = req.body;
        const tenantId = parseInt(req.params.id);

        const tenant = await get('SELECT * FROM tenants WHERE id = ?', [tenantId]);
        if (!tenant) {
            return res.status(404).json({ error: 'Tenant not found' });
        }

        const updates = [];
        const params = [];

        if (subscription_plan) {
            updates.push('subscription_plan = ?');
            params.push(subscription_plan);
        }
        if (subscription_status) {
            updates.push('subscription_status = ?');
            params.push(subscription_status);
        }
        if (max_users !== undefined) {
            updates.push('max_users = ?');
            params.push(parseInt(max_users));
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        params.push(tenantId);
        await run(`UPDATE tenants SET ${updates.join(', ')} WHERE id = ?`, params);

        console.log(`[ADMIN] Updated tenant ${tenantId}: ${updates.join(', ')}`);

        const updated = await get('SELECT * FROM tenants WHERE id = ?', [tenantId]);
        res.json({ tenant: updated });
    } catch (error) {
        console.error('[ADMIN] Update tenant error:', error.message);
        res.status(500).json({ error: 'Failed to update tenant' });
    }
});

/**
 * PUT /api/v1/admin/tenants/:id/suspend
 * Toggle suspend/unsuspend a tenant
 */
router.put('/tenants/:id/suspend', async (req, res) => {
    try {
        const tenantId = parseInt(req.params.id);
        const tenant = await get('SELECT * FROM tenants WHERE id = ?', [tenantId]);
        if (!tenant) {
            return res.status(404).json({ error: 'Tenant not found' });
        }

        const newStatus = tenant.subscription_status === 'cancelled' ? 'active' : 'cancelled';
        await run('UPDATE tenants SET subscription_status = ? WHERE id = ?', [newStatus, tenantId]);

        console.log(`[ADMIN] Tenant ${tenantId} status changed to: ${newStatus}`);

        const updated = await get('SELECT * FROM tenants WHERE id = ?', [tenantId]);
        res.json({ tenant: updated, message: newStatus === 'cancelled' ? 'Tenant suspended' : 'Tenant reactivated' });
    } catch (error) {
        console.error('[ADMIN] Suspend tenant error:', error.message);
        res.status(500).json({ error: 'Failed to suspend tenant' });
    }
});

/**
 * DELETE /api/v1/admin/tenants/:id
 * Permanently delete tenant and all associated data (CASCADE handles children)
 */
router.delete('/tenants/:id', async (req, res) => {
    try {
        const tenantId = parseInt(req.params.id);
        const tenant = await get('SELECT * FROM tenants WHERE id = ?', [tenantId]);
        if (!tenant) {
            return res.status(404).json({ error: 'Tenant not found' });
        }

        // Don't allow deleting the default tenant (id=1)
        if (tenantId === 1) {
            return res.status(400).json({ error: 'Cannot delete the default platform tenant' });
        }

        // CASCADE deletes handle all child records
        await run('DELETE FROM tenants WHERE id = ?', [tenantId]);

        console.log(`[ADMIN] Deleted tenant ${tenantId} (${tenant.name})`);

        res.json({ message: `Tenant "${tenant.name}" and all data permanently deleted` });
    } catch (error) {
        console.error('[ADMIN] Delete tenant error:', error.message);
        res.status(500).json({ error: 'Failed to delete tenant' });
    }
});

export default router;
