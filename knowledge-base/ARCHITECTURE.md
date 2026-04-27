# Architecture

## Directory Structure

```
whatsapp-broadcast-saas/
├── knowledge-base/              # This documentation
├── backend/
│   ├── package.json             # whatsapp-broadcast-api
│   ├── src/
│   │   ├── server.js            # Entry point — starts Express on PORT
│   │   ├── app.js               # Express app setup, routes, webhook handler
│   │   ├── config.js            # Environment config loader
│   │   ├── database.js          # MySQL connection pool + table migrations
│   │   ├── middleware/
│   │   │   ├── auth.js          # JWT authentication middleware
│   │   │   └── tenant.js        # Multi-tenant slug → tenantId resolution
│   │   ├── routes/
│   │   │   ├── auth.js          # POST /login, /register, /me
│   │   │   ├── contacts.js      # CRUD + import + tags + locations
│   │   │   ├── whatsapp.js      # Templates, broadcast, recipients, campaigns
│   │   │   ├── whatsapp-chat.js # Chat inbox: conversations, messages, send
│   │   │   └── settings.js      # Tenant settings + WhatsApp credential management
│   │   └── services/
│   │       └── whatsapp.js      # Meta Cloud API wrapper (send, templates, media)
│   └── uploads/                 # Multer file uploads (CSV imports, media)
├── frontend/
│   ├── package.json             # whatsapp-broadcast-frontend
│   ├── vite.config.js           # Vite + Preact config
│   ├── index.html               # SPA entry
│   └── src/
│       ├── App.jsx              # Main app — routing between 4 views
│       ├── index.jsx            # Preact render entry
│       ├── index.css            # Global CSS design system
│       ├── stores/
│       │   └── store.js         # Zustand store — all state + API calls
│       └── components/
│           ├── Sidebar.jsx      # Navigation (Contacts, Broadcast, Chat, Settings)
│           ├── Contacts.jsx     # Contact management UI
│           ├── WhatsAppBroadcast.jsx  # Broadcast send flow
│           ├── WhatsAppChat.jsx       # Chat inbox UI
│           ├── Settings.jsx     # Tenant settings & credentials
│           ├── Login.jsx        # Login/Register form
│           ├── Icons.jsx        # SVG icon library
│           └── Toast.jsx        # Toast notification component
├── Dockerfile                   # Docker build (optional)
├── .dockerignore
├── .gitignore
└── README.md
```

## Database Schema

### Core Tables

#### `tenants`
```sql
CREATE TABLE tenants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,     -- used in x-tenant-slug header
    email VARCHAR(255),
    phone VARCHAR(50),
    logo_url TEXT,
    brand_color VARCHAR(7) DEFAULT '#6C63FF',
    plan_id INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### `users`
```sql
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,        -- bcrypt hashed
    role ENUM('admin','user') DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
```

#### `tenant_settings`
```sql
CREATE TABLE tenant_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT UNIQUE NOT NULL,
    whatsapp_access_token TEXT,            -- Meta API token (long-lived)
    whatsapp_phone_number_id VARCHAR(50),  -- Meta phone number ID
    whatsapp_business_account_id VARCHAR(50), -- WABA ID
    whatsapp_webhook_secret VARCHAR(255),
    whatsapp_connected BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
```

#### `contacts`
```sql
CREATE TABLE contacts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    location VARCHAR(255),                 -- city/area — filterable
    ticket_size DECIMAL(15,2),             -- budget/value — filterable
    tags JSON,                             -- ["tag1", "tag2"]
    notes TEXT,
    source VARCHAR(100),
    whatsapp_consent BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    INDEX idx_phone (phone),
    INDEX idx_location (location),
    INDEX idx_tenant (tenant_id)
);
```

#### `whatsapp_conversations`
```sql
CREATE TABLE whatsapp_conversations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    phone VARCHAR(20) NOT NULL,
    contact_name VARCHAR(255),
    contact_id INT,                        -- matched to contacts table
    last_message_text TEXT,
    last_message_at DATETIME,
    last_customer_message_at DATETIME,     -- for 24h window calc
    window_expires_at DATETIME,            -- 24h after last customer msg
    unread_count INT DEFAULT 0,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    UNIQUE KEY unique_tenant_phone (tenant_id, phone)
);
```

#### `whatsapp_chat_messages`
```sql
CREATE TABLE whatsapp_chat_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    tenant_id INT NOT NULL,
    direction ENUM('inbound','outbound') NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text', -- text, image, template, etc.
    body TEXT,
    media_id VARCHAR(255),
    media_url TEXT,
    provider_message_id VARCHAR(255),
    status ENUM('pending','sent','delivered','read','failed') DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES whatsapp_conversations(id),
    INDEX idx_conversation (conversation_id),
    INDEX idx_provider_msg (provider_message_id)
);
```

#### `whatsapp_campaigns`
```sql
CREATE TABLE whatsapp_campaigns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    template_name VARCHAR(255),
    total_recipients INT DEFAULT 0,
    sent INT DEFAULT 0,
    delivered INT DEFAULT 0,
    read_count INT DEFAULT 0,
    failed INT DEFAULT 0,
    status ENUM('pending','sending','completed','failed') DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
```

#### `whatsapp_messages` (broadcast tracking)
```sql
CREATE TABLE whatsapp_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    campaign_id INT,
    recipient_phone VARCHAR(50),
    recipient_name VARCHAR(255),
    template_name VARCHAR(255),
    provider_message_id VARCHAR(255),
    status ENUM('pending','sent','delivered','read','failed') DEFAULT 'pending',
    error_message TEXT,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    delivered_at DATETIME,
    read_at DATETIME,
    FOREIGN KEY (campaign_id) REFERENCES whatsapp_campaigns(id),
    INDEX idx_provider_msg (provider_message_id)
);
```

## API Endpoints

### Auth (`/api/v1/auth`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/login` | Login with email/password, returns JWT |
| POST | `/register` | Register new user (creates tenant if needed) |
| GET | `/me` | Get current user info |

### Contacts (`/api/v1/contacts`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List contacts (search, tag, location, min_ticket, max_ticket filters, pagination) |
| POST | `/` | Create contact |
| PUT | `/:id` | Update contact |
| DELETE | `/:id` | Delete contact |
| POST | `/import` | Bulk CSV import |
| GET | `/tags/list` | Get all unique tags |
| GET | `/locations/list` | Get all unique locations |

### WhatsApp Broadcast (`/api/v1/whatsapp`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/recipients` | Get filtered contacts for broadcast (tag, search, location, min_ticket, max_ticket) |
| GET | `/templates` | List Meta-approved templates |
| POST | `/templates` | Create & submit template to Meta |
| PUT | `/templates/:id` | Edit template components (body, footer, buttons, image) |
| DELETE | `/templates/:name` | Delete template from Meta |
| POST | `/broadcast` | Send broadcast to recipients |
| GET | `/campaigns` | List past campaigns |
| GET | `/campaigns/:id` | Campaign detail with message statuses |

### Chat Inbox (`/api/v1/whatsapp/chat`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/conversations` | List conversations (unread counts, window status) |
| GET | `/conversations/:id/messages` | Get messages for a conversation |
| POST | `/conversations/:id/send` | Send free-form text (24h window enforced) |
| POST | `/conversations/:id/send-template` | Send template message (always allowed) |
| PATCH | `/conversations/:id/read` | Mark conversation as read |
| PATCH | `/conversations/:id/archive` | Toggle archive status |

### Settings (`/api/v1/settings`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Get tenant settings |
| PUT | `/profile` | Update firm profile |
| PUT | `/whatsapp` | Save & verify WhatsApp credentials |
| POST | `/whatsapp/disconnect` | Disconnect WhatsApp |

### Webhook (`/webhook/whatsapp` — in app.js)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/webhook/whatsapp` | Meta webhook verification (challenge response) |
| POST | `/webhook/whatsapp` | Incoming messages & status updates |

## Data Flow Diagrams

### Broadcast Flow
```
User selects recipients (by tag/location/ticket_size)
  → User picks template
  → POST /api/v1/whatsapp/broadcast
  → Backend creates campaign record
  → Loop: for each recipient
    → Call Meta API: POST /v21.0/{phone_number_id}/messages
    → Store message in whatsapp_messages table
    → 100ms delay between sends
  → Return campaign results
  → Meta sends status webhooks (sent → delivered → read)
  → Webhook handler updates message status
```

### Chat Flow (Inbound)
```
Customer sends WhatsApp message
  → Meta sends webhook to POST /webhook/whatsapp
  → Extract phone_number_id → find tenant
  → Find or create conversation (by phone + tenant_id)
  → Match contact by phone number
  → Store message in whatsapp_chat_messages
  → Update conversation: last_message, unread_count, window_expires_at (+24h)
  → Frontend polls GET /conversations every 8 seconds
  → UI shows new message
```

### Chat Flow (Outbound)
```
User types reply in chat
  → POST /conversations/:id/send {body: "text"}
  → Backend checks: is window_expires_at > now?
    → YES: Call Meta API with type: "text"
    → NO: Return 400 "Window expired, use template"
  → Store outbound message in whatsapp_chat_messages
  → Return success
```

## Authentication Flow

```
1. User enters email + password
2. POST /api/v1/auth/login
3. Backend finds user → verifies bcrypt password
4. Returns JWT token + tenant slug + user info
5. Frontend stores token in Zustand (persisted to localStorage)
6. All subsequent API calls include:
   - Authorization: Bearer <token>
   - x-tenant-slug: <slug>
7. Backend middleware:
   - auth.js: verifies JWT, injects req.userId
   - tenant.js: resolves slug → tenant, injects req.tenantId, req.tenant
```
