# Development Guide

## Local Development Setup

### Prerequisites
- Node.js 18+ (recommended: 20+)
- MySQL 8.0+
- Git

### Step 1: Clone

```bash
git clone https://github.com/shivanshu407/whatsapp-broadcast-saas.git
cd whatsapp-broadcast-saas
```

### Step 2: Backend Setup

```bash
cd backend
npm install
```

Create `backend/.env`:
```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=whatsapp_broadcast_dev

JWT_SECRET=dev_jwt_secret_change_in_production
WEBHOOK_VERIFY_TOKEN=dev_webhook_token
```

Start backend:
```bash
npm run dev
# Uses --watch flag for auto-restart on file changes
```

The backend will auto-create all database tables on first startup.

### Step 3: Frontend Setup

```bash
cd frontend
npm install
npm run dev
# Starts Vite dev server on http://localhost:5173
```

### Step 4: First User

1. Open `http://localhost:5173`
2. Register a new account (this creates a tenant + admin user)
3. Go to Settings → WhatsApp Configuration
4. Enter your Meta API credentials

## Coding Patterns & Conventions

### Backend Patterns

#### Route Structure
Every route file follows this pattern:
```javascript
import { Router } from 'express';
import { query, run, get } from '../database.js';

const router = Router();

router.get('/', async (req, res) => {
    try {
        const tenantId = req.tenantId; // Always available via middleware
        // ... logic
        res.json({ data });
    } catch (err) {
        console.error('Route description error:', err);
        res.status(500).json({ error: 'Something went wrong' });
    }
});

export default router;
```

#### Database Functions
```javascript
// query(sql, params) — returns array of rows (for SELECT)
const rows = await query('SELECT * FROM contacts WHERE tenant_id = ?', [tenantId]);

// run(sql, params) — returns { insertId, affectedRows } (for INSERT/UPDATE/DELETE)
const result = await run('INSERT INTO contacts (tenant_id, name) VALUES (?, ?)', [tenantId, name]);

// get(sql, params) — returns single row or null (for SELECT ... LIMIT 1)
const contact = await get('SELECT * FROM contacts WHERE id = ? AND tenant_id = ?', [id, tenantId]);
```

#### Multi-Tenant Rule
**EVERY database query MUST filter by `tenant_id`**. This is the #1 security rule:
```javascript
// ✅ CORRECT
const contacts = await query('SELECT * FROM contacts WHERE tenant_id = ?', [req.tenantId]);

// ❌ WRONG — data leak across tenants
const contacts = await query('SELECT * FROM contacts WHERE id = ?', [id]);
```

#### WhatsApp Service Functions
```javascript
import { 
    sendTemplateMessage,    // Send approved template
    sendTextMessage,        // Send free-form text (24h window only)
    sendMediaMessage,       // Send image/video/document
    sendBulkMessages,       // Broadcast to multiple recipients
    getTemplates,           // List Meta templates
    createTemplate,         // Submit template for approval
    deleteTemplate,         // Delete template from Meta
    getMediaUrl             // Get downloadable URL for media
} from '../services/whatsapp.js';

// All functions require a `tenant` object with whatsapp credentials:
const tenant = req.tenant; // Has: whatsapp_access_token, whatsapp_phone_number_id, etc.
```

### Frontend Patterns

#### Zustand Store
All state and API calls live in `stores/store.js`. No component-level API calls.

```javascript
// Access store in components:
import { useStore } from '../stores/store';

export default function MyComponent() {
    const { contacts, fetchContacts, createContact } = useStore();
    // ...
}
```

#### API Call Pattern (in store)
```javascript
fetchContacts: async (params = {}) => {
    try {
        const queryString = new URLSearchParams(params).toString();
        const res = await fetch(`/api/v1/contacts?${queryString}`, {
            headers: get().authHeaders()  // Includes JWT + tenant slug
        });
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        set({ contacts: data.contacts, contactsTotal: data.total });
    } catch (err) {
        console.error('fetchContacts error:', err);
        get().showToast('Failed to load contacts', 'error');
    }
},
```

#### Auth Headers Helper
```javascript
authHeaders: () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${get().token}`,
    'x-tenant-slug': get().tenantSlug
}),
```

#### Component Structure
Components use Preact (same as React but `import { useState } from 'preact/hooks'`):
```jsx
import { useState, useEffect } from 'preact/hooks';
import { useStore } from '../stores/store';
import Icon from './Icons';

export default function MyComponent() {
    const { data, fetchData } = useStore();
    const [localState, setLocalState] = useState('');

    useEffect(() => { fetchData(); }, []);

    return (
        <div className="page-container">
            {/* Component JSX */}
        </div>
    );
}
```

#### CSS Design System
Global styles are in `index.css` with CSS custom properties:
```css
/* Key variables */
--bg-primary       /* Main background */
--bg-secondary     /* Card/section background */
--text-primary     /* Main text color */
--text-secondary   /* Muted text */
--accent-primary   /* Brand purple (#6C63FF) */
--accent-success   /* Green */
--accent-warning   /* Orange */
--accent-danger    /* Red */
--space-1 to --space-8  /* Spacing scale */
--text-xs to --text-2xl /* Font sizes */
--radius-sm/md/lg  /* Border radius */
```

#### Icon Usage
```jsx
import Icon from './Icons';
// Available icons: search, plus, edit, delete, close, filter, send,
// chat, contacts, whatsapp, broadcast, settings, users, download,
// upload, check, x, archive, logout, phone, mail, tag, copy, 
// chevron-down, chevron-right, eye, eye-off, refresh, bell
<Icon name="search" size={16} />
```

## Adding a New Feature — Checklist

### New Backend Route
1. Create `backend/src/routes/myfeature.js`
2. Import and mount in `app.js`: `app.use('/api/v1/myfeature', authMiddleware, tenantMiddleware, myfeatureRoute);`
3. Always filter by `req.tenantId` in queries

### New Frontend View
1. Create `frontend/src/components/MyFeature.jsx`
2. Add store functions in `stores/store.js`
3. Add route in `App.jsx` switch statement
4. Add nav item in `Sidebar.jsx`
5. Add icon in `Icons.jsx` if needed

### New Database Table
1. Add `CREATE TABLE IF NOT EXISTS` in `database.js` `initializeDatabase()` function
2. Always include `tenant_id INT NOT NULL` column
3. Add foreign key to tenants table

## Common Gotchas

1. **Preact vs React**: Use `import { useState } from 'preact/hooks'` not `'react'`
2. **JSON tags field**: MySQL stores tags as JSON — use `JSON.parse()` when reading, `JSON.stringify()` when writing
3. **WhatsApp 24h window**: Only **template messages** work after 24 hours. Text/media require an active window.
4. **Template approval**: Templates submitted to Meta need manual approval (24-48h). Only `APPROVED` templates can be sent.
5. **Phone number format**: Meta requires international format with country code, no + prefix (e.g., `919876543210`)
6. **Webhook is public**: The `/webhook/whatsapp` endpoint has no auth — it's verified by Meta's challenge token
7. **Frontend builds to `frontend/dist/`**: Nginx serves these static files. After rebuilding, no restart needed.
8. **Store persistence**: Zustand persists `token`, `user`, `tenantSlug` to localStorage
