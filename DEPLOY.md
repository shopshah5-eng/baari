# BAARI — Deployment & Production Guide

This document describes how to deploy the Baari monorepo (`apps/web` Next.js frontend + `apps/engine` Express service + PostgreSQL/Supabase).

---

## 1. Architecture Overview

```
baari/
├─ apps/
│  ├─ web/          # Next.js 15 App Router, TypeScript, Tailwind CSS, shadcn/ui
│  │                # Port: 3001. Auth, Onboarding, Dashboards, Desk, Cabin, TV
│  └─ engine/       # Express domain engine service
│                   # Port: 3000. Queue, EWMA ETA, WhatsApp Gateway, Billing, Reports
├─ packages/
│  ├─ shared/       # Zod schemas, dynamic label dictionary, message templates, types
│  └─ ui/           # Design system primitives (Indigo #5746F5, Inter, tabular numbers)
├─ supabase/migrations/
│  ├─ 0001_init.sql # 18 production tables + RLS + idempotent call_next + recompute_eta
│  └─ 0002_v2_surface.sql # users, memberships, onboarding, knowledge_chunks, templates
└─ docker-compose.yml
```

---

## 2. Quick Local Start (Docker)

```bash
cp .env.example .env
docker-compose up --build
```

- Web UI: `http://localhost:3001`
- Engine API: `http://localhost:3000`
- Postgres (pgvector): `localhost:5432`

---

## 3. Running Without Docker

```bash
# 1. Install all monorepo dependencies
npm install --legacy-peer-deps

# 2. Build shared packages
npm --prefix packages/shared run build

# 3. Run all automated tests (34 passing)
npm test          # 26 engine tests
npm run test:sql  # 8 SQL schema & tenant isolation tests

# 4. Start services
npm run dev       # Starts engine on :3000 and web on :3001 concurrently
```

---

## 4. Third-Party Integrations Setup

### A. Meta WhatsApp Embedded Signup
1. Create an app in [Meta for Developers](https://developers.facebook.com/) under Type: **Business**.
2. Add the **WhatsApp** product.
3. In WhatsApp > Quickstart > Configuration, create a WhatsApp Configuration ID (`META_CONFIG_ID`).
4. Set the Webhook URL to `https://your-domain.com/engine-api/webhooks/whatsapp` with Verify Token (`WHATSAPP_WEBHOOK_VERIFY_TOKEN`).
5. Subscribe to `messages` and `message_template_status_update`.

### B. Supabase / Postgres
1. In your Supabase dashboard or self-hosted Postgres, run the migrations:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_v2_surface.sql`
2. Verify that Row Level Security (RLS) is active on every tenant table.
3. Set `DATABASE_URL` in your production environment.

### C. Razorpay & Direct UPI
1. In Razorpay Dashboard > Settings > Webhooks, add `https://your-domain.com/api/webhooks/razorpay` with events: `payment.captured`, `order.paid`.
2. For Direct Zero-MDR UPI payments, set your UPI VPA (`UPI_VPA=baari@okaxis`) and payee name.

---

## 5. Production Checklist

- [x] All 26 engine tests green (`npm test`).
- [x] All 8 SQL schema & tenant isolation tests green (`npm run test:sql`).
- [x] Next.js 15 production build succeeds (`npm --prefix apps/web run build`).
- [x] Quiet hours (21:00–08:00 IST) enforced at gateway level.
- [x] Review policy: non-gated, Google review link sent to 100% of respondents.
- [x] Receptionist sessions scoped with PIN; cannot access revenue or medical history.
- [x] 60-second undo window on all desk actions.

