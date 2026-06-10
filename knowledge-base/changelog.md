# Changelog

All notable changes to the WhatsApp Broadcast SaaS project, in reverse chronological order.

---

## 2026-06-10 — Fixed Vercel Backend Entrypoint
**What**: Updated Vercel backend `entrypoint` to `backend/src/app.js`.
**Why**: Vercel `@vercel/node` requires the entrypoint to export the Express app for Serverless Functions. Using `backend` as the entrypoint caused build errors, and `server.js` didn't export the app.
**Files Changed**: `vercel.json`
**Commit**: N/A
- Changed backend `entrypoint` to `backend/src/app.js`

---

## 2026-06-10 — Fixed Vercel Backend Route Prefix
**What**: Changed Vercel backend `routePrefix` to `/api`.
**Why**: The frontend requests were failing with "Unexpected end of JSON input" because they were hitting `/api/v1/...` while Vercel was routing the backend on `/_/backend`. This caused Vercel to send the API request to the Vite frontend fallback instead of the backend.
**Files Changed**: `vercel.json`
**Commit**: N/A
- Changed backend `routePrefix` from `/_/backend` to `/api`

---

## 2026-06-10 — Fixed Vercel Deployment Configuration
**What**: Fixed Vercel build error by renaming `root` to `entrypoint` in `vercel.json`.
**Why**: Vercel threw `Service "backend" must specify "framework", "entrypoint"...` because the experimental services config requires the `entrypoint` key rather than `root`.
**Files Changed**: `vercel.json`
**Commit**: N/A
- Changed `"root": "frontend"` to `"entrypoint": "frontend"`
- Changed `"root": "backend"` to `"entrypoint": "backend"`

---

## 2026-06-10 — Changed GitHub Remote Repository
**What**: Updated the project's Git remote `origin` to a new GitHub repository URL.
**Why**: User requested to push the codebase to a new central repository.
**Files Changed**: None (Git configuration updated)
**Commit**: N/A
- Changed remote `origin` from `shivanshu407/whatsapp-broadcast-saas` to `MBKANERIYA/whatsapp`
- Pushed the `main` branch to the new remote repository

---

## 2026-04-27 — Feature: Template Edit Functionality
**What**: Added ability to edit existing WhatsApp templates from the Templates tab
**Why**: Users previously had to delete and recreate templates to make changes — now they can edit body, footer, buttons, and header image directly
**Files Changed**: `backend/src/services/whatsapp.js`, `backend/src/routes/whatsapp.js`, `frontend/src/stores/store.js`, `frontend/src/components/WhatsAppBroadcast.jsx`
- Backend: Added `editTemplate()` service function that calls Meta's `POST /{template_id}` API to update template components
- Backend: Added `PUT /api/v1/whatsapp/templates/:id` route that accepts updated body/footer/buttons/image and forwards to Meta API, also updates local DB record
- Frontend Store: Added `editWhatsAppTemplate` Zustand action
- Frontend UI: "Edit" button in template list table opens a full-screen modal with:
  - Read-only display of name, category, language (Meta doesn't allow changing these)
  - Editable body text, footer, header image, and button builder
  - Live WhatsApp-style preview panel (matches the create template preview)
  - Pre-fills all fields from the existing template's Meta component data
  - On save, resubmits template to Meta for review and shows success toast
- Invalidates template definition cache after edit to ensure fresh data

---

## 2026-04-22 — Fix: Message Timestamps Showing in UTC
**What**: Fixed chat messages and conversation list timestamps showing UTC time instead of local time
**Why**: Database timestamps are stored in UTC without timezone markers, so the frontend interpreted them as local time before formatting
**Files Changed**: `frontend/src/components/WhatsAppChat.jsx`
- Added `parseUTC` helper to append `Z` to timestamp strings from the backend
- This forces the JavaScript `Date` object to parse it as UTC rather than local time
- `toLocaleTimeString` and `toLocaleDateString` now correctly convert the UTC time to the user's local timezone (e.g., IST)
- Applied to both the conversation list timestamps and the individual message timestamps

---

## 2026-04-22 — Fix: Messages & Replies Not Showing in Chat Inbox
**What**: Fixed chat inbox not displaying new messages or customer replies
**Why**: Stale JavaScript closure bug — the polling setInterval captured the initial null value of selectedConvId, so message polling NEVER ran after the initial click
**Files Changed**: `frontend/src/components/WhatsAppChat.jsx`, `backend/src/app.js`, `backend/src/routes/whatsapp-chat.js`
- Root Cause: `useEffect` with `[]` dependency meant `selectedConvId` was always `null` inside the interval callback (React stale closure)
- Fix: Use refs (`selectedConvIdRef`, `searchRef`) that stay in sync with state, so the interval always reads current values
- Polling now restarts when conversation changes for immediate responsiveness
- Added detailed webhook logging to trace incoming message processing
- Added messages API endpoint logging to help debug empty message responses

---

## 2026-04-17 — Feature: Rich Template Cards in Chat Inbox
**What**: Template messages now display as full WhatsApp-style cards with header image, body, footer, and buttons
**Why**: Previously showed only `[Template: n1]` or plain body text — users couldn't see the complete message sent to customers
**Files Changed**: `backend/src/routes/whatsapp-chat.js`, `backend/src/services/whatsapp.js`, `frontend/src/components/WhatsAppChat.jsx`
**Commit**: `9a584bc`
- Backend `resolveTemplateBody()` now stores rich JSON with all template components (header, body, footer, buttons)
- `getTemplatePlainText()` extracts plain text for sidebar conversation preview
- Frontend `TemplateCard` component renders WhatsApp-style cards with:
  - Header images (IMAGE), video placeholders, document icons, text headers
  - Body text with variables filled in
  - Footer text
  - Styled buttons (phone, URL, quick reply) with icons
- Backward compatible: old `[Template: name]` format messages still render as before
- Only new messages after deploy get the rich card format

---

## 2026-04-15 — Fix: Broadcast Messages Not Sending (All Campaigns Failed)
**What**: Fixed broadcasts showing 0 sent / 0 failed / status "Failed"
**Why**: `processBroadcast` background function crashed before sending messages; error was hidden from UI
**Files Changed**: `backend/src/routes/whatsapp.js`, `backend/src/database.js`, `frontend/src/components/WhatsAppBroadcast.jsx`
**Commit**: `4c63172`
- Reload tenant from DB in `processBroadcast` instead of using potentially stale cache object
- Show `error_log` in campaign history table and campaign detail modal
- Added step-by-step console.log in `processBroadcast` for server-side debugging
- Added missing `buttons_json` column to `whatsapp_templates` table migration
- Wrapped the catch block's DB update in its own try/catch to prevent silent failures

## 2026-04-15 — Feature: Start New Chat from Inbox
**What**: Added ability to start new WhatsApp conversations from the Chat Inbox
**Why**: Chat Inbox had no way to initiate conversations — only showed replies to broadcasts
**Files Changed**: `backend/src/routes/whatsapp-chat.js`, `frontend/src/components/WhatsAppChat.jsx`, `frontend/src/stores/store.js`
**Commit**: `d75c69c`
- Green "+" button next to search bar to start new conversation
- Two-step modal: (1) Enter phone or select from contacts list (2) Pick template + fill variables
- WhatsApp-style inline preview of template before sending
- Backend `POST /conversations/new` creates/finds conversation, sends template, stores message
- "Start New Chat" CTA button shown when conversation list is empty
- Contact search with hover effects and arrow icon

## 2026-04-15 — Fix: LIMIT/OFFSET Prepared Statement in Chat
**What**: Fixed `ER_WRONG_ARGUMENTS` crash in chat conversations and messages queries
**Why**: MySQL `pool.execute()` doesn't support `?` placeholders for LIMIT/OFFSET
**Files Changed**: `backend/src/routes/whatsapp-chat.js`
**Commit**: `0ea06a5`
- Inlined LIMIT and OFFSET as `parseInt()` values in both conversation list and message list queries

## 2026-04-14 — Admin Panel for Tenant Management
**What**: Added super admin panel to manage user accounts (temporary dev tool)
**Why**: Need to upgrade/suspend/delete tenants during development without direct DB access
**Files Changed**: `backend/src/routes/admin.js` [NEW], `frontend/src/components/AdminPanel.jsx` [NEW], `backend/src/app.js`, `frontend/src/App.jsx`, `frontend/src/components/Sidebar.jsx`
**Commit**: `b958740`
- Backend: GET/PUT/DELETE /api/v1/admin/tenants endpoints protected by `superAdminOnly` middleware
- Frontend: Card-based UI with inline edit for plan/status, suspend toggle, delete with confirmation
- View users per tenant in expandable section
- Sidebar shows "Admin Panel" link only for users with `role === 'admin'`
- Backend enforces `SUPER_ADMIN_EMAILS` env var — must be set on server
- Default tenant (id=1) cannot be deleted

## 2026-04-11 — MySQL LIMIT/OFFSET Prepared Statement Fix
**What**: Fixed contacts GET endpoint crashing with `ER_WRONG_ARGUMENTS` (errno 1210)
**Why**: MySQL `pool.execute()` uses server-side prepared statements which don't support `LIMIT ?` or `OFFSET ?` as placeholders
**Files Changed**: `backend/src/routes/contacts.js`
**Commit**: `27dcc88`
- Inlined LIMIT and OFFSET as `parseInt()` values instead of `?` placeholders
- This was the root cause of "imported contacts not visible" — the GET always crashed silently
- All imports were actually succeeding (verified via debug logs)

## 2026-04-11 — Tenant Auth System Overhaul (3 commits)
**What**: Fixed "Account not found" and "Invalid credentials" errors on login/logout/new-device
**Why**: Single-domain SaaS (`broadcast.innodify.in`) was being treated as subdomain-based multi-tenant
**Files Changed**: `backend/src/middleware/tenant.js`, `backend/src/middleware/auth.js`, `backend/src/routes/auth.js`, `frontend/src/stores/store.js`
**Commits**: `2c6f0a8`, `3c72a5f`, `e841410`
- **Frontend** `getTenantSlug()`: Recognizes `broadcast`, `app`, `www`, `api`, `admin` as app domains (not tenants)
- **Backend** `resolveTenant`: Made "soft" — if slug not found, passes with `null` instead of blocking with 404
- **Backend** `auth` middleware: Now loads tenant from JWT `tenantId` when tenant middleware didn't resolve
- **Backend** login route: Searches by email across ALL tenants (not scoped to `req.tenantId`)
- Added final check: rejects if no `tenantId` from either slug or JWT

## 2026-04-11 — CSV File Upload Import (Contacts)
**What**: Replaced text-paste import modal with proper CSV file upload
**Why**: Users need to upload CSV files, not paste raw text
**Files Changed**: `frontend/src/components/Contacts.jsx`, `frontend/src/stores/store.js`
**Commit**: `0cad430`
- Click-to-upload area with dashed border UI
- Parses CSV with header detection (skips row if contains "name"+"phone")
- Preview table showing first 5 rows before import
- "Download Template" button inside modal
- Template button in header downloads `contacts_import_template.csv`
- `importContacts` now `await`s `fetchContacts()` for guaranteed refresh

## 2026-04-10 — Comprehensive Responsive Adaptation
**What**: Full responsive overhaul for tablet (1024px) and mobile (768px)
**Why**: All component grids used inline `style={{}}` which CSS media queries couldn't override
**Files Changed**: `frontend/src/styles/main.css`, `frontend/src/components/WhatsAppChat.jsx`, `frontend/src/components/Icons.jsx`
**Commit**: `2c31e9c`
- Added tablet breakpoint (≤1024px) and expanded mobile breakpoint (≤768px)
- CSS attribute selectors override inline grids: `[style*="1fr 1fr 1fr"]`, `[style*="1fr 340px"]`
- Chat inbox: mobile shows list/chat toggle with ← back button
- 44px min touch targets, 16px font inputs (prevents iOS zoom)
- Added `arrow-left` icon to icon system

## 2026-04-10 — WhatsApp Button Types Support
**What**: Template builder now supports all WhatsApp button types (Call, URL, Quick Reply)
**Why**: Previously only supported call buttons; Meta allows URL and Quick Reply too
**Files Changed**: `backend/src/services/whatsapp.js`, `backend/src/routes/whatsapp.js`, `frontend/src/components/WhatsAppBroadcast.jsx`
**Commit**: `21db69f`
- Dynamic button builder UI: + Call, + Website, + Quick Reply
- Auto-disables at Meta limits (1 call, 2 URL)
- Backend `createTemplate` accepts generic `buttons[]` array
- Live preview renders all button types with correct WhatsApp icons
