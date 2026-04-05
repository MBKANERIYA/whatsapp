import { getTenantBySlug } from '../database.js';
import config from '../config.js';

/**
 * Tenant Resolution Middleware
 * 
 * Resolves the current tenant from the request subdomain.
 * Example: firm-a.procrm.in → slug = "firm-a"
 * 
 * Injects into request:
 *   - req.tenant   → Full tenant object from DB
 *   - req.tenantId → Shorthand for tenant.id (used in queries)
 */
export const resolveTenant = async (req, res, next) => {
  try {
    // Extract slug from subdomain
    const host = req.hostname; // e.g., "firm-a.procrm.in" or "localhost"
    let slug;

    if (config.nodeEnv === 'development') {
      // In development, use x-tenant-slug header or default to 'default'
      slug = req.headers['x-tenant-slug'] || 'default';
    } else {
      // In production, extract subdomain from hostname
      // "firm-a.procrm.in" → "firm-a"
      // "admin.procrm.in" → "admin" (super admin panel)
      const parts = host.split('.');
      if (parts.length >= 3) {
        slug = parts[0]; // subdomain
      } else {
        // Bare domain (procrm.in) — could be landing page
        slug = req.headers['x-tenant-slug'] || null;
      }
    }

    if (!slug) {
      return res.status(400).json({ error: 'Invalid tenant. Use a subdomain like firm-name.procrm.in' });
    }

    // Skip tenant resolution for super admin panel
    if (slug === 'admin' || slug === 'api') {
      req.tenant = null;
      req.tenantId = null;
      return next();
    }

    // Look up tenant from cache/DB
    const tenant = await getTenantBySlug(slug);

    if (!tenant) {
      return res.status(404).json({ error: 'Firm not found. Check your URL.' });
    }

    // Check subscription status
    if (tenant.subscription_status === 'expired') {
      return res.status(403).json({
        error: 'Your subscription has expired. Please renew to continue.',
        subscription_expired: true,
      });
    }

    if (tenant.subscription_status === 'cancelled') {
      return res.status(403).json({
        error: 'This account has been deactivated.',
      });
    }

    // Check trial expiry
    if (tenant.subscription_plan === 'trial' && tenant.trial_ends_at) {
      const trialEnd = new Date(tenant.trial_ends_at);
      if (trialEnd < new Date()) {
        return res.status(403).json({
          error: 'Your free trial has ended. Choose a plan to continue.',
          trial_expired: true,
        });
      }
    }

    // Inject tenant into request
    req.tenant = tenant;
    req.tenantId = tenant.id;

    next();
  } catch (error) {
    console.error('Tenant resolution error:', error.message);
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Super Admin Only Middleware
 * Checks if the authenticated user is a platform super admin.
 * Super admins are identified by email in config.superAdminEmails.
 */
export const superAdminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const superAdminEmails = config.superAdminEmails || [];

  if (!superAdminEmails.includes(req.user.email)) {
    return res.status(403).json({ error: 'Super admin access required' });
  }

  next();
};
