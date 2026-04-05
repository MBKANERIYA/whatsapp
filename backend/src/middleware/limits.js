import { query } from '../database.js';

/**
 * Check if tenant can add more users (enforced on registration)
 */
export const checkUserLimit = async (req, res, next) => {
  try {
    const tenant = req.tenant;
    if (!tenant) return next(); // Skip if no tenant (super admin)

    const users = await query(
      'SELECT COUNT(*) as count FROM users WHERE tenant_id = ?',
      [tenant.id]
    );
    const currentCount = users[0].count;

    if (currentCount >= tenant.max_users) {
      return res.status(403).json({
        error: `User limit reached (${tenant.max_users}). Upgrade your plan to add more team members.`,
        limit: tenant.max_users,
        current: currentCount,
        upgrade_required: true,
      });
    }

    next();
  } catch (error) {
    console.error('User limit check error:', error.message);
    next(); // Don't block on errors, let the request through
  }
};

/**
 * Check if WhatsApp feature is enabled for this tenant
 * - Trial plan: WhatsApp disabled
 * - All paid plans: WhatsApp enabled (but tenant must configure Meta API credentials)
 */
export const checkWhatsAppEnabled = (req, res, next) => {
  const tenant = req.tenant;

  if (!tenant) {
    return res.status(400).json({ error: 'Tenant context required' });
  }

  // Trial plans don't get WhatsApp
  if (tenant.subscription_plan === 'trial') {
    return res.status(403).json({
      error: 'WhatsApp is available on all paid plans. Upgrade from trial to unlock.',
      upgrade_required: true,
    });
  }

  // Check if tenant has configured their Meta API credentials
  if (!tenant.whatsapp_configured) {
    return res.status(403).json({
      error: 'WhatsApp not configured. Add your Meta Business API credentials in Settings.',
      whatsapp_not_configured: true,
    });
  }

  next();
};
