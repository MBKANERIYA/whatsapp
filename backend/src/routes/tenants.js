import { Router } from 'express';
import { query, run, get } from '../database.js';
import { auth } from '../middleware/auth.js';
import { superAdminOnly } from '../middleware/tenant.js';

const router = Router();

/**
 * All routes here require: auth + super admin
 * These are platform-owner routes (admin.procrm.in)
 */
router.use(auth, superAdminOnly);

/**
 * GET /api/v1/admin/dashboard
 * Platform-level stats (total tenants, revenue, users, etc.)
 */
router.get('/dashboard', async (req, res) => {
    try {
        const stats = {};

        const tenantCount = await get('SELECT COUNT(*) as count FROM tenants');
        stats.total_tenants = tenantCount?.count || 0;

        const activeCount = await get("SELECT COUNT(*) as count FROM tenants WHERE subscription_status IN ('active', 'trial')");
        stats.active_tenants = activeCount?.count || 0;

        const userCount = await get('SELECT COUNT(*) as count FROM users');
        stats.total_users = userCount?.count || 0;

        const leadCount = await get('SELECT COUNT(*) as count FROM leads');
        stats.total_leads = leadCount?.count || 0;

        // Tenants by plan
        const planBreakdown = await query(
            'SELECT subscription_plan, COUNT(*) as count FROM tenants GROUP BY subscription_plan'
        );
        stats.tenants_by_plan = {};
        for (const row of planBreakdown) {
            stats.tenants_by_plan[row.subscription_plan] = row.count;
        }

        // Recent signups (last 7 days)
        const recentSignups = await query(`
            SELECT id, name, slug, email, subscription_plan, subscription_status, created_at
            FROM tenants ORDER BY created_at DESC LIMIT 10
        `);
        stats.recent_signups = recentSignups;

        // Tenants with expired trials
        const expiredTrials = await get(`
            SELECT COUNT(*) as count FROM tenants 
            WHERE subscription_plan = 'trial' AND trial_ends_at < NOW()
        `);
        stats.expired_trials = expiredTrials?.count || 0;

        res.json(stats);
    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * GET /api/v1/admin/tenants
 * List all tenants with stats
 */
router.get('/tenants', async (req, res) => {
    try {
        const { search, plan, status } = req.query;

        let sql = `
            SELECT t.*,
                   (SELECT COUNT(*) FROM users WHERE tenant_id = t.id) as user_count,
                   (SELECT COUNT(*) FROM leads WHERE tenant_id = t.id) as lead_count,
                   (SELECT COUNT(*) FROM clients WHERE tenant_id = t.id) as client_count
            FROM tenants t
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            sql += ' AND (t.name LIKE ? OR t.slug LIKE ? OR t.email LIKE ?)';
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern);
        }

        if (plan) {
            sql += ' AND t.subscription_plan = ?';
            params.push(plan);
        }

        if (status) {
            sql += ' AND t.subscription_status = ?';
            params.push(status);
        }

        sql += ' ORDER BY t.created_at DESC LIMIT 100';

        const tenants = await query(sql, params);

        // Mask sensitive fields
        const safeTenants = tenants.map(t => ({
            ...t,
            whatsapp_access_token: t.whatsapp_configured ? '••••' : null,
        }));

        res.json(safeTenants);
    } catch (error) {
        console.error('Admin tenants list error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * GET /api/v1/admin/tenants/:id
 * Get single tenant details
 */
router.get('/tenants/:id', async (req, res) => {
    try {
        const tenant = await get('SELECT * FROM tenants WHERE id = ?', [req.params.id]);
        if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

        const users = await query(
            'SELECT id, name, email, role, created_at FROM users WHERE tenant_id = ? ORDER BY created_at',
            [req.params.id]
        );

        const stats = {
            leads: (await get('SELECT COUNT(*) as c FROM leads WHERE tenant_id = ?', [req.params.id]))?.c || 0,
            clients: (await get('SELECT COUNT(*) as c FROM clients WHERE tenant_id = ?', [req.params.id]))?.c || 0,
            campaigns: (await get('SELECT COUNT(*) as c FROM whatsapp_campaigns WHERE tenant_id = ?', [req.params.id]))?.c || 0,
        };

        res.json({
            ...tenant,
            whatsapp_access_token: tenant.whatsapp_configured ? '••••' : null,
            users,
            stats,
        });
    } catch (error) {
        console.error('Admin tenant detail error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * PATCH /api/v1/admin/tenants/:id/plan
 * Manually change a tenant's plan (super admin override)
 */
router.patch('/tenants/:id/plan', async (req, res) => {
    try {
        const { subscription_plan, subscription_status, max_users } = req.body;

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
        if (max_users) {
            updates.push('max_users = ?');
            params.push(max_users);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nothing to update' });
        }

        params.push(req.params.id);

        await run(`UPDATE tenants SET ${updates.join(', ')} WHERE id = ?`, params);

        res.json({ success: true, message: 'Tenant plan updated' });
    } catch (error) {
        console.error('Admin plan update error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * PATCH /api/v1/admin/tenants/:id/suspend
 * Suspend a tenant
 */
router.patch('/tenants/:id/suspend', async (req, res) => {
    try {
        await run(
            "UPDATE tenants SET subscription_status = 'cancelled' WHERE id = ?",
            [req.params.id]
        );
        res.json({ success: true, message: 'Tenant suspended' });
    } catch (error) {
        console.error('Admin suspend error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * PATCH /api/v1/admin/tenants/:id/activate
 * Reactivate a suspended tenant
 */
router.patch('/tenants/:id/activate', async (req, res) => {
    try {
        await run(
            "UPDATE tenants SET subscription_status = 'active' WHERE id = ?",
            [req.params.id]
        );
        res.json({ success: true, message: 'Tenant activated' });
    } catch (error) {
        console.error('Admin activate error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * DELETE /api/v1/admin/tenants/:id
 * Permanently delete a tenant and all their data (CASCADE)
 */
router.delete('/tenants/:id', async (req, res) => {
    try {
        // Prevent deleting the default tenant
        const tenant = await get('SELECT slug FROM tenants WHERE id = ?', [req.params.id]);
        if (tenant?.slug === 'default') {
            return res.status(400).json({ error: 'Cannot delete the default tenant' });
        }

        // CASCADE handles all child data
        await run('DELETE FROM tenants WHERE id = ?', [req.params.id]);

        res.json({ success: true, message: 'Tenant and all data deleted permanently' });
    } catch (error) {
        console.error('Admin tenant delete error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * GET /api/v1/admin/plans
 * List subscription plans
 */
router.get('/plans', async (req, res) => {
    try {
        const plans = await query('SELECT * FROM subscription_plans ORDER BY price_monthly');
        res.json(plans);
    } catch (error) {
        console.error('Admin plans list error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/**
 * PUT /api/v1/admin/plans/:id
 * Update a subscription plan's pricing or limits
 */
router.put('/plans/:id', async (req, res) => {
    try {
        const { display_name, price_monthly, price_yearly, max_users, whatsapp_enabled, is_active } = req.body;

        await run(`
            UPDATE subscription_plans 
            SET display_name = ?, price_monthly = ?, price_yearly = ?, max_users = ?, whatsapp_enabled = ?, is_active = ?
            WHERE id = ?
        `, [display_name, price_monthly, price_yearly, max_users, whatsapp_enabled, is_active, req.params.id]);

        res.json({ success: true, message: 'Plan updated' });
    } catch (error) {
        console.error('Admin plan update error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
