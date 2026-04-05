import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { run, get } from '../database.js';
import { generateToken } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/v1/onboarding/signup
 * PUBLIC endpoint — creates a new tenant + admin user
 * No auth required. No tenant middleware needed (tenant doesn't exist yet).
 * 
 * Body: { firmName, slug, name, email, password, phone }
 */
router.post('/signup', async (req, res) => {
    try {
        const { firmName, slug, name, email, password, phone } = req.body;

        // Validation
        if (!firmName || !slug || !name || !email || !password) {
            return res.status(400).json({
                error: 'All fields required: firmName, slug, name, email, password',
            });
        }

        // Slug validation (lowercase, alphanumeric + hyphens only)
        const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
        if (cleanSlug.length < 3 || cleanSlug.length > 50) {
            return res.status(400).json({
                error: 'Slug must be 3-50 characters (letters, numbers, hyphens only)',
            });
        }

        // Reserved slugs
        const reserved = ['admin', 'api', 'www', 'app', 'mail', 'ftp', 'test', 'staging', 'dev', 'demo', 'support', 'help', 'billing'];
        if (reserved.includes(cleanSlug)) {
            return res.status(400).json({ error: 'This URL is reserved. Choose a different one.' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Check if slug is taken
        const existingTenant = await get('SELECT id FROM tenants WHERE slug = ?', [cleanSlug]);
        if (existingTenant) {
            return res.status(409).json({ error: 'This URL is already taken. Try a different one.' });
        }

        // Check if email already exists globally (prevent duplicate admin accounts across tenants)
        // Note: same email CAN exist in different tenants as agents, but we prevent the same 
        // email from being the PRIMARY admin of multiple tenants
        const existingEmail = await get(
            "SELECT id FROM users WHERE email = ? AND role = 'admin'",
            [email]
        );
        if (existingEmail) {
            return res.status(409).json({
                error: 'This email is already registered as an admin on another firm. Use a different email.',
            });
        }

        // Calculate trial end date (14 days from now)
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + 14);
        const trialEndsStr = trialEndsAt.toISOString().slice(0, 19).replace('T', ' ');

        // Create tenant
        const tenantResult = await run(`
            INSERT INTO tenants (name, slug, email, phone, subscription_plan, subscription_status, trial_ends_at, max_users)
            VALUES (?, ?, ?, ?, 'trial', 'trial', ?, 3)
        `, [firmName, cleanSlug, email, phone || null, trialEndsStr]);

        const tenantId = tenantResult.lastInsertRowid;

        // Create admin user
        const passwordHash = bcrypt.hashSync(password, 10);

        const userResult = await run(`
            INSERT INTO users (tenant_id, name, email, password_hash, role)
            VALUES (?, ?, ?, ?, 'admin')
        `, [tenantId, name, email, passwordHash]);

        const userId = userResult.lastInsertRowid;

        // Create default lead sources for the new tenant
        const defaultSources = ['Website', 'Walk-in', 'Referral', 'MagicBricks', '99acres', 'Housing.com', 'WhatsApp', 'Facebook', 'Instagram', 'Other'];
        for (const sourceName of defaultSources) {
            try {
                await run(
                    'INSERT INTO sources (tenant_id, name, type) VALUES (?, ?, ?)',
                    [tenantId, sourceName, 'lead']
                );
            } catch (e) {
                // Non-fatal — some sources might fail on duplicate
            }
        }

        // Generate JWT token so user is logged in immediately
        const token = generateToken(userId, email, 'admin', tenantId);

        res.status(201).json({
            success: true,
            message: 'Firm registered successfully! Your 14-day trial has started.',
            token,
            user: {
                id: userId,
                name,
                email,
                role: 'admin',
            },
            tenant: {
                id: tenantId,
                name: firmName,
                slug: cleanSlug,
                subscription_plan: 'trial',
                trial_ends_at: trialEndsStr,
            },
        });
    } catch (error) {
        console.error('Onboarding signup error:', error);
        res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
});

/**
 * GET /api/v1/onboarding/check-slug/:slug
 * PUBLIC — Check if a slug is available
 */
router.get('/check-slug/:slug', async (req, res) => {
    try {
        const slug = req.params.slug.toLowerCase().replace(/[^a-z0-9-]/g, '');

        const reserved = ['admin', 'api', 'www', 'app', 'mail', 'ftp', 'test', 'staging', 'dev', 'demo', 'support', 'help', 'billing'];
        if (reserved.includes(slug)) {
            return res.json({ available: false, reason: 'This URL is reserved' });
        }

        if (slug.length < 3) {
            return res.json({ available: false, reason: 'Minimum 3 characters' });
        }

        const existing = await get('SELECT id FROM tenants WHERE slug = ?', [slug]);

        res.json({
            available: !existing,
            slug,
            url: `${slug}.procrm.in`,
            reason: existing ? 'Already taken' : null,
        });
    } catch (error) {
        console.error('Check slug error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
