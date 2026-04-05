import mysql from 'mysql2/promise';
import config from './config.js';

let pool = null;
let initialized = false;

// In-memory tenant cache (slug -> tenant object, refreshed every 60s)
const tenantCache = new Map();
let tenantCacheTime = 0;
const TENANT_CACHE_TTL = 60000; // 60 seconds

// Initialize database connection pool
const initDatabase = async () => {
  if (initialized && pool) {
    return pool;
  }

  try {
    pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      dateStrings: true,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
    });

    console.log('MySQL connection pool created');

    // Run migrations
    await migrate();

    initialized = true;
    return pool;
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
};

// ============================================================
// MIGRATIONS
// ============================================================
const migrate = async () => {

  // --------------------------------------------------------
  // STEP 1: Create tenants table FIRST (other tables reference it)
  // --------------------------------------------------------
  try {
    await pool.execute(`CREATE TABLE IF NOT EXISTS tenants (
      id INT AUTO_INCREMENT PRIMARY KEY,

      -- Identity
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(100) UNIQUE NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(50),

      -- Branding
      logo_url VARCHAR(500),
      primary_color VARCHAR(7) DEFAULT '#6366f1',

      -- Subscription
      subscription_plan ENUM('trial','basic','pro','enterprise') DEFAULT 'trial',
      subscription_status ENUM('active','trial','expired','cancelled') DEFAULT 'trial',
      trial_ends_at DATETIME,
      razorpay_subscription_id VARCHAR(255),
      razorpay_customer_id VARCHAR(255),

      -- WhatsApp (per-tenant Meta Cloud API credentials)
      whatsapp_access_token TEXT,
      whatsapp_phone_number_id VARCHAR(50),
      whatsapp_business_account_id VARCHAR(50),
      whatsapp_configured BOOLEAN DEFAULT FALSE,

      -- Limits (only user count — leads are unlimited)
      max_users INT DEFAULT 5,

      -- Metadata
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      INDEX idx_slug (slug),
      INDEX idx_status (subscription_status)
    )`);
  } catch (error) {
    if (!error.message.includes('already exists')) {
      console.error('Migration error (tenants):', error.message);
    }
  }

  // --------------------------------------------------------
  // STEP 2: Create subscription_plans table
  // --------------------------------------------------------
  try {
    await pool.execute(`CREATE TABLE IF NOT EXISTS subscription_plans (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(50) NOT NULL,
      display_name VARCHAR(100) NOT NULL,
      price_monthly INT NOT NULL,
      price_yearly INT,
      max_users INT NOT NULL DEFAULT 5,
      whatsapp_enabled BOOLEAN DEFAULT TRUE,
      razorpay_plan_id_monthly VARCHAR(255),
      razorpay_plan_id_yearly VARCHAR(255),
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
  } catch (error) {
    if (!error.message.includes('already exists')) {
      console.error('Migration error (subscription_plans):', error.message);
    }
  }

  // --------------------------------------------------------
  // STEP 3: Core business tables (with tenant_id)
  // --------------------------------------------------------
  const coreMigrations = [
    // Users table
    `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'agent',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      UNIQUE KEY uk_tenant_email (tenant_id, email),
      INDEX idx_tenant (tenant_id)
    )`,

    // Sources table
    `CREATE TABLE IF NOT EXISTS sources (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL DEFAULT 'online',
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      UNIQUE KEY uk_tenant_source (tenant_id, name),
      INDEX idx_tenant (tenant_id)
    )`,

    // Leads table
    `CREATE TABLE IF NOT EXISTS leads (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      email VARCHAR(255),
      budget_min DECIMAL(15,2),
      budget_max DECIMAL(15,2),
      location VARCHAR(255),
      interest VARCHAR(255),
      motive_to_buy VARCHAR(255),
      contact_person VARCHAR(255),
      source VARCHAR(255),
      source_id INT,
      status VARCHAR(50) NOT NULL DEFAULT 'new',
      escalated TINYINT NOT NULL DEFAULT 0,
      assigned_to INT,
      whatsapp_consent BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE SET NULL,
      FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_tenant (tenant_id),
      INDEX idx_status (status),
      INDEX idx_assigned (assigned_to),
      INDEX idx_escalated (escalated)
    )`,

    // Follow-ups table
    `CREATE TABLE IF NOT EXISTS follow_ups (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NOT NULL,
      lead_id INT NOT NULL,
      user_id INT NOT NULL,
      scheduled_at DATETIME NOT NULL,
      type VARCHAR(50) NOT NULL DEFAULT 'call',
      notes TEXT,
      completed TINYINT NOT NULL DEFAULT 0,
      completed_at DATETIME,
      outcome VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_tenant (tenant_id),
      INDEX idx_scheduled (scheduled_at)
    )`,

    // Clients table
    `CREATE TABLE IF NOT EXISTS clients (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      email VARCHAR(255),
      location VARCHAR(255),
      source VARCHAR(255),
      lead_id INT,
      deal_date DATE,
      price DECIMAL(15,2),
      property_details TEXT,
      documents_link VARCHAR(500),
      alternate_phone VARCHAR(50),
      whatsapp_consent BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
      INDEX idx_tenant (tenant_id)
    )`,

    // Site Visits table
    `CREATE TABLE IF NOT EXISTS site_visits (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NOT NULL,
      lead_id INT NOT NULL,
      scheduled_at DATETIME NOT NULL,
      location VARCHAR(255),
      notes TEXT,
      status VARCHAR(50) DEFAULT 'scheduled',
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_tenant (tenant_id),
      INDEX idx_scheduled (scheduled_at)
    )`,

    // Status updates (audit trail)
    `CREATE TABLE IF NOT EXISTS status_updates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NOT NULL,
      lead_id INT NOT NULL,
      user_id INT NOT NULL,
      old_status VARCHAR(50),
      new_status VARCHAR(50) NOT NULL,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_tenant (tenant_id)
    )`,

    // Tasks table
    `CREATE TABLE IF NOT EXISTS tasks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      assigned_to INT,
      lead_id INT,
      due_date DATETIME,
      priority VARCHAR(50) NOT NULL DEFAULT 'medium',
      completed TINYINT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
      INDEX idx_tenant (tenant_id)
    )`,

    // Inventory table
    `CREATE TABLE IF NOT EXISTS inventory (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NOT NULL,
      photo_link VARCHAR(500),
      location VARCHAR(255),
      size VARCHAR(100),
      demand VARCHAR(100),
      property_type VARCHAR(100),
      listing_type ENUM('sale', 'rent') DEFAULT 'sale',
      status ENUM('available', 'engaged', 'sold') DEFAULT 'available',
      is_hot BOOLEAN DEFAULT FALSE,
      price DECIMAL(15,2),
      other_details TEXT,
      project_id INT,
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_tenant (tenant_id)
    )`,

    // Cold reminders table
    `CREATE TABLE IF NOT EXISTS cold_reminders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NOT NULL,
      lead_id INT NOT NULL,
      user_id INT NOT NULL,
      remind_at DATETIME NOT NULL,
      notes TEXT,
      completed BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_tenant (tenant_id)
    )`,

    // Projects table
    `CREATE TABLE IF NOT EXISTS projects (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      location VARCHAR(255),
      builder VARCHAR(255),
      total_units INT DEFAULT 0,
      unit_types JSON,
      description TEXT,
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_tenant (tenant_id)
    )`,

    // WhatsApp campaign history
    `CREATE TABLE IF NOT EXISTS whatsapp_campaigns (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      campaign_name VARCHAR(255) NOT NULL,
      recipient_type ENUM('all_clients', 'all_leads', 'leads_by_status', 'custom') NOT NULL,
      recipient_filter JSON,
      total_recipients INT NOT NULL DEFAULT 0,
      successful_count INT DEFAULT 0,
      failed_count INT DEFAULT 0,
      status ENUM('draft', 'processing', 'completed', 'failed') DEFAULT 'draft',
      sent_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      error_log TEXT,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (sent_by) REFERENCES users(id),
      INDEX idx_tenant (tenant_id)
    )`,

    // WhatsApp individual message log
    `CREATE TABLE IF NOT EXISTS whatsapp_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NOT NULL,
      campaign_id INT,
      phone VARCHAR(20) NOT NULL,
      recipient_name VARCHAR(255),
      recipient_type ENUM('lead', 'client') NOT NULL,
      recipient_id INT,
      status ENUM('pending', 'sent', 'delivered', 'read', 'failed') DEFAULT 'pending',
      provider_message_id VARCHAR(255),
      error_message TEXT,
      sent_at DATETIME,
      delivered_at DATETIME,
      read_at DATETIME,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (campaign_id) REFERENCES whatsapp_campaigns(id) ON DELETE SET NULL,
      INDEX idx_tenant (tenant_id)
    )`,

    // WhatsApp templates
    `CREATE TABLE IF NOT EXISTS whatsapp_templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NOT NULL,
      meta_template_id VARCHAR(255),
      name VARCHAR(255) NOT NULL,
      category VARCHAR(50) DEFAULT 'MARKETING',
      language VARCHAR(10) DEFAULT 'en',
      body_text TEXT NOT NULL,
      has_header_image BOOLEAN DEFAULT FALSE,
      footer_text VARCHAR(60),
      call_button_text VARCHAR(25),
      call_button_phone VARCHAR(20),
      status VARCHAR(50) DEFAULT 'PENDING',
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_tenant (tenant_id)
    )`,
  ];

  for (const sql of coreMigrations) {
    try {
      await pool.execute(sql);
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.error('Migration error:', error.message);
      }
    }
  }

  // --------------------------------------------------------
  // STEP 4: Add project_id FK to inventory (if not exists)
  // --------------------------------------------------------
  try {
    await pool.execute('ALTER TABLE inventory ADD FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL');
  } catch (error) {
    // FK already exists, ignore
  }

  // --------------------------------------------------------
  // STEP 5: Seed subscription plans
  // --------------------------------------------------------
  const plans = [
    ['trial', 'Free Trial', 0, null, 2, false],
    ['basic', 'Basic Plan', 99900, 999000, 5, true],
    ['pro', 'Pro Plan', 249900, 2499000, 15, true],
    ['enterprise', 'Enterprise Plan', 499900, 4999000, 50, true],
  ];

  for (const [name, displayName, priceMonthly, priceYearly, maxUsers, whatsappEnabled] of plans) {
    try {
      await pool.execute(
        `INSERT IGNORE INTO subscription_plans 
         (name, display_name, price_monthly, price_yearly, max_users, whatsapp_enabled) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [name, displayName, priceMonthly, priceYearly, maxUsers, whatsappEnabled]
      );
    } catch (error) {
      // Already seeded, ignore
    }
  }

  // --------------------------------------------------------
  // STEP 6: Seed default tenant + admin (for fresh databases)
  // --------------------------------------------------------
  try {
    const [tenants] = await pool.execute('SELECT COUNT(*) as count FROM tenants');
    if (tenants[0].count === 0) {
      // Create default tenant
      await pool.execute(
        `INSERT INTO tenants (name, slug, email, subscription_plan, subscription_status, max_users)
         VALUES (?, ?, ?, 'enterprise', 'active', 50)`,
        ['Default Firm', 'default', 'admin@crm.local']
      );

      // Create default admin user for this tenant
      const bcrypt = await import('bcryptjs');
      const passwordHash = bcrypt.default.hashSync('admin123', 10);
      await pool.execute(
        'INSERT INTO users (tenant_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
        [1, 'Admin', 'admin@crm.local', passwordHash, 'admin']
      );

      // Seed sources for the default tenant
      const sources = [
        ['Facebook', 'social'], ['Instagram', 'social'], ['WhatsApp', 'direct'],
        ['Google Ads', 'ads'], ['Walk-in', 'offline'], ['Referral', 'offline'],
        ['MagicBricks', 'portal'], ['99acres', 'portal'],
        ['Housing.com', 'portal'], ['NoBroker', 'portal'],
      ];
      for (const [name, type] of sources) {
        await pool.execute(
          'INSERT IGNORE INTO sources (tenant_id, name, type) VALUES (?, ?, ?)',
          [1, name, type]
        );
      }

      console.log('Default tenant + admin created: admin@crm.local / admin123');
    }
  } catch (error) {
    console.log('Seed error (may already exist):', error.message);
  }

  console.log('Database migrations completed');
};

// ============================================================
// TENANT CACHE
// ============================================================

/**
 * Get tenant by slug (with caching)
 */
export const getTenantBySlug = async (slug) => {
  // Refresh cache if stale
  if (Date.now() - tenantCacheTime > TENANT_CACHE_TTL) {
    await refreshTenantCache();
  }
  return tenantCache.get(slug) || null;
};

/**
 * Get tenant by ID
 */
export const getTenantById = async (id) => {
  const tenant = await get('SELECT * FROM tenants WHERE id = ?', [id]);
  return tenant;
};

/**
 * Refresh the tenant cache from DB
 */
const refreshTenantCache = async () => {
  try {
    const tenants = await query('SELECT * FROM tenants WHERE subscription_status != ?', ['cancelled']);
    tenantCache.clear();
    for (const tenant of tenants) {
      tenantCache.set(tenant.slug, tenant);
    }
    tenantCacheTime = Date.now();
  } catch (error) {
    console.error('Failed to refresh tenant cache:', error.message);
  }
};

/**
 * Invalidate tenant cache (call after tenant updates)
 */
export const invalidateTenantCache = () => {
  tenantCacheTime = 0;
};

// ============================================================
// QUERY HELPERS
// ============================================================

// Generic query helper
export const query = async (sql, params = []) => {
  if (!pool) {
    await initDatabase();
  }
  const [rows] = await pool.execute(sql, params);
  return rows;
};

// Execute helper (for INSERT, UPDATE, DELETE)
export const run = async (sql, params = []) => {
  if (!pool) {
    await initDatabase();
  }
  const [result] = await pool.execute(sql, params);
  return { lastInsertRowid: result.insertId, changes: result.affectedRows };
};

// Get single row helper
export const get = async (sql, params = []) => {
  if (!pool) {
    await initDatabase();
  }
  const [rows] = await pool.execute(sql, params);
  return rows[0] || null;
};

export { initDatabase };
export default { query, run, get, initDatabase, getTenantBySlug, getTenantById, invalidateTenantCache };
