// Config for Real Estate CRM SaaS
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
const envPath = path.join(__dirname, '..', envFile);

dotenv.config({ path: envPath });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

if (!process.env.DB_USER) {
    dotenv.config({ path: path.join(process.cwd(), envFile) });
    dotenv.config({ path: path.join(process.cwd(), '.env') });
}

export default {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',

    // MySQL Database
    db: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'crm_saas',
    },

    // JWT
    jwtSecret: (() => {
        const secret = process.env.JWT_SECRET;
        if (process.env.NODE_ENV === 'production' && (!secret || secret === 'change-me-in-production')) {
            throw new Error('FATAL: JWT_SECRET must be set to a strong value in production');
        }
        return secret || 'dev-only-secret-not-for-production';
    })(),
    jwtExpiration: parseInt(process.env.JWT_EXPIRATION) || 86400,

    // CORS
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],

    // App Domain (for tenant subdomain routing)
    appDomain: process.env.APP_DOMAIN || 'localhost',

    // Super Admin emails (platform owners)
    superAdminEmails: process.env.SUPER_ADMIN_EMAILS?.split(',') || [],

    // Razorpay (subscription billing)
    razorpay: {
        keyId: process.env.RAZORPAY_KEY_ID || '',
        keySecret: process.env.RAZORPAY_KEY_SECRET || '',
        webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
    },
};
