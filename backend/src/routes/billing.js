import { Router } from 'express';
import crypto from 'crypto';
import { run, get, query } from '../database.js';
import { invalidateTenantCache } from '../database.js';
import config from '../config.js';

const router = Router();

/**
 * All routes require auth + admin
 */
router.use((req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
});

/**
 * POST /api/v1/billing/create-subscription
 * Create a Razorpay subscription for the tenant
 * Body: { plan_id } (Razorpay plan ID, e.g., "plan_xxxx")
 */
router.post('/create-subscription', async (req, res) => {
    try {
        const { plan_id } = req.body;

        if (!plan_id) {
            return res.status(400).json({ error: 'Plan ID is required' });
        }

        if (!config.razorpay.keyId || !config.razorpay.keySecret) {
            return res.status(503).json({ error: 'Payment system not configured yet' });
        }

        const tenant = await get('SELECT * FROM tenants WHERE id = ?', [req.tenantId]);
        if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

        // Create Razorpay customer if not exists
        let customerId = tenant.razorpay_customer_id;
        if (!customerId) {
            const customerRes = await fetch('https://api.razorpay.com/v1/customers', {
                method: 'POST',
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(`${config.razorpay.keyId}:${config.razorpay.keySecret}`).toString('base64'),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: tenant.name,
                    email: tenant.email,
                    contact: tenant.phone || '',
                    notes: { tenant_id: tenant.id, slug: tenant.slug },
                }),
            });

            const customerData = await customerRes.json();
            if (!customerRes.ok) {
                return res.status(500).json({ error: 'Failed to create payment customer', details: customerData });
            }

            customerId = customerData.id;
            await run('UPDATE tenants SET razorpay_customer_id = ? WHERE id = ?', [customerId, req.tenantId]);
        }

        // Create subscription
        const subRes = await fetch('https://api.razorpay.com/v1/subscriptions', {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + Buffer.from(`${config.razorpay.keyId}:${config.razorpay.keySecret}`).toString('base64'),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                plan_id,
                customer_id: customerId,
                total_count: 120, // 10 years max
                quantity: 1,
                notes: {
                    tenant_id: tenant.id,
                    tenant_slug: tenant.slug,
                },
            }),
        });

        const subData = await subRes.json();
        if (!subRes.ok) {
            return res.status(500).json({ error: 'Failed to create subscription', details: subData });
        }

        // Save subscription ID
        await run(
            'UPDATE tenants SET razorpay_subscription_id = ? WHERE id = ?',
            [subData.id, req.tenantId]
        );

        res.json({
            success: true,
            subscription_id: subData.id,
            razorpay_key: config.razorpay.keyId,
            short_url: subData.short_url, // Razorpay hosted payment page
        });
    } catch (error) {
        console.error('Create subscription error:', error);
        res.status(500).json({ error: 'Payment error' });
    }
});

/**
 * POST /api/v1/billing/verify-payment
 * Verify Razorpay payment signature after checkout
 * Body: { razorpay_payment_id, razorpay_subscription_id, razorpay_signature }
 */
router.post('/verify-payment', async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = req.body;

        if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
            return res.status(400).json({ error: 'Missing payment verification fields' });
        }

        // Verify signature
        const generatedSignature = crypto
            .createHmac('sha256', config.razorpay.keySecret)
            .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
            .digest('hex');

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({ error: 'Payment verification failed' });
        }

        // Look up which plan this subscription maps to
        const plan = await get(
            'SELECT * FROM subscription_plans WHERE razorpay_plan_id_monthly = ? OR razorpay_plan_id_yearly = ?',
            [razorpay_subscription_id, razorpay_subscription_id]
        );

        // Activate the tenant's subscription
        const planName = plan?.name || 'basic';
        const maxUsers = plan?.max_users || 10;

        await run(`
            UPDATE tenants 
            SET subscription_plan = ?, subscription_status = 'active', 
                max_users = ?, razorpay_subscription_id = ?
            WHERE id = ?
        `, [planName, maxUsers, razorpay_subscription_id, req.tenantId]);

        invalidateTenantCache(req.tenant.slug);

        res.json({
            success: true,
            message: 'Subscription activated!',
            plan: planName,
        });
    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({ error: 'Verification failed' });
    }
});

/**
 * GET /api/v1/billing/invoices
 * Fetch invoices from Razorpay
 */
router.get('/invoices', async (req, res) => {
    try {
        const tenant = await get(
            'SELECT razorpay_subscription_id FROM tenants WHERE id = ?',
            [req.tenantId]
        );

        if (!tenant?.razorpay_subscription_id) {
            return res.json({ invoices: [], message: 'No active subscription' });
        }

        if (!config.razorpay.keyId || !config.razorpay.keySecret) {
            return res.json({ invoices: [], message: 'Payment system not configured' });
        }

        const invoiceRes = await fetch(
            `https://api.razorpay.com/v1/invoices?subscription_id=${tenant.razorpay_subscription_id}`,
            {
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(`${config.razorpay.keyId}:${config.razorpay.keySecret}`).toString('base64'),
                },
            }
        );

        const invoiceData = await invoiceRes.json();

        res.json({
            invoices: invoiceData.items || [],
        });
    } catch (error) {
        console.error('Invoices fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch invoices' });
    }
});

/**
 * POST /api/v1/billing/cancel
 * Cancel the current subscription
 */
router.post('/cancel', async (req, res) => {
    try {
        const tenant = await get(
            'SELECT razorpay_subscription_id FROM tenants WHERE id = ?',
            [req.tenantId]
        );

        if (!tenant?.razorpay_subscription_id) {
            return res.status(400).json({ error: 'No active subscription to cancel' });
        }

        // Cancel on Razorpay (at end of cycle)
        const cancelRes = await fetch(
            `https://api.razorpay.com/v1/subscriptions/${tenant.razorpay_subscription_id}/cancel`,
            {
                method: 'POST',
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(`${config.razorpay.keyId}:${config.razorpay.keySecret}`).toString('base64'),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ cancel_at_cycle_end: 1 }),
            }
        );

        if (!cancelRes.ok) {
            const err = await cancelRes.json();
            return res.status(500).json({ error: 'Cancellation failed', details: err });
        }

        await run(
            "UPDATE tenants SET subscription_status = 'cancelled' WHERE id = ?",
            [req.tenantId]
        );

        invalidateTenantCache(req.tenant.slug);

        res.json({ success: true, message: 'Subscription will be cancelled at end of billing cycle' });
    } catch (error) {
        console.error('Subscription cancel error:', error);
        res.status(500).json({ error: 'Cancellation failed' });
    }
});

export default router;
