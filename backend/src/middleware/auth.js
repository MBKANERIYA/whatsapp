import jwt from 'jsonwebtoken';
import config from '../config.js';

/**
 * JWT Authentication Middleware
 * Extracts user from token and adds to req.user
 * Token payload includes: userId, email, role, tenantId
 */
export const auth = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: 'Authorization header required' });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.status(401).json({ error: 'Invalid authorization format' });
    }

    const token = parts[1];

    try {
        const decoded = jwt.verify(token, config.jwtSecret);
        req.user = decoded;

        // Also set tenantId from JWT if not already set by tenant middleware
        // This ensures tenantId is available even without subdomain resolution
        if (decoded.tenantId && !req.tenantId) {
            req.tenantId = decoded.tenantId;
        }

        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

/**
 * Admin-only middleware (tenant admin, not super admin)
 */
export const adminOnly = (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

/**
 * Generate JWT token (now includes tenantId)
 */
export const generateToken = (userId, email, role, tenantId) => {
    return jwt.sign(
        { userId, email, role, tenantId },
        config.jwtSecret,
        { expiresIn: config.jwtExpiration }
    );
};
