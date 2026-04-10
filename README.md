# WhatsApp Broadcast SaaS

A multi-tenant WhatsApp marketing and chat platform built with Node.js, Preact, and the Meta Cloud API.

## Features

- **📇 Contact Management** — Unified contacts with location, ticket size, tags, CSV import
- **📢 WhatsApp Broadcast** — Send template messages to filtered contacts (by tag, location, budget)
- **💬 Chat Inbox** — Two-way WhatsApp messaging with 24-hour window enforcement
- **⚙️ Settings** — Firm profile, WhatsApp credential management, subscription plans
- **🏢 Multi-Tenant** — Each customer gets isolated data, uses their own Meta API credentials

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Preact + Vite + Zustand |
| Backend | Express.js (Node.js 20+) |
| Database | MySQL 8.0 |
| WhatsApp | Meta Cloud API v21.0 |
| Hosting | Hostinger VPS (Nginx + PM2) |

## Architecture

```
Customer's Meta Account ──→ Our Platform ──→ Contacts / Broadcast / Chat
         ↑                                              │
         └──── Webhook (incoming messages) ─────────────┘
```

- **Customers provide their own Meta WhatsApp Business API credentials**
- **Meta bills customers directly** for message usage
- **We charge a platform subscription fee** (SaaS revenue)

## Quick Start

### Prerequisites
- Node.js 18+
- MySQL 8.0+

### Setup

```bash
# Clone
git clone https://github.com/shivanshu407/whatsapp-broadcast-saas.git
cd whatsapp-broadcast-saas

# Backend
cd backend && npm install
cp .env.example .env  # Edit with your DB credentials
npm run dev

# Frontend (new terminal)
cd frontend && npm install
npm run dev
```

### Environment Variables

```env
PORT=3000
NODE_ENV=development
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=whatsapp_broadcast
JWT_SECRET=your_jwt_secret
WEBHOOK_VERIFY_TOKEN=your_webhook_token
```

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── app.js              # Express app + webhook handler
│   │   ├── database.js         # MySQL + auto-migrations
│   │   ├── routes/
│   │   │   ├── contacts.js     # Contact CRUD + import
│   │   │   ├── whatsapp.js     # Broadcast + templates
│   │   │   ├── whatsapp-chat.js # Chat inbox API
│   │   │   └── settings.js     # Tenant settings
│   │   └── services/
│   │       └── whatsapp.js     # Meta API wrapper
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx             # 4 views: Contacts, Broadcast, Chat, Settings
│   │   ├── stores/store.js     # Zustand state + API calls
│   │   └── components/         # UI components
│   └── package.json
└── knowledge-base/             # Full project documentation
```

## Documentation

See the `knowledge-base/` folder for comprehensive documentation:
- **PROJECT_OVERVIEW.md** — Business model, features, design decisions
- **ARCHITECTURE.md** — Database schema, API endpoints, data flows
- **DEPLOYMENT.md** — Step-by-step VPS deployment guide
- **DEVELOPMENT_GUIDE.md** — Coding patterns and conventions

## Deployment

Hosted on Hostinger VPS at `broadcast.innodify.in`. See `knowledge-base/DEPLOYMENT.md` for full deployment instructions.

## License

Private — All rights reserved.
