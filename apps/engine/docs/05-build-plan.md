# BAARI — Technical Build Plan & Google Antigravity Prompt
**Stack:** Node.js 22 + Express · Multi-tenant Supabase (Postgres + RLS) · Google OAuth · per-tenant Baileys QR **+** Meta WhatsApp Cloud API failover · Gemini 2.5 Flash (text/vision/audio) · Direct UPI QR + Razorpay · Vanilla/PWA frontend (no framework build step for the desk & TV — they must load on a ₹8k tablet over 3G).

> **Status:** this document is the spec. A runnable v0 skeleton is generated next turn (see §9).

---

## 1. Architecture

```
                        ┌────────────────────────────────────────────┐
   Patient WhatsApp ───▶│  wa-gateway (per-tenant sessions)          │
   (Baileys QR / Meta)  │  · session manager (auth dir per tenant)   │
                        │  · in/out queue (BullMQ + Redis)           │
                        │  · anti-ban throttle · health monitor      │
                        └───────────────────┬────────────────────────┘
                                            │ normalized InboundMessage
                                            ▼
┌──────────────┐   ┌───────────────────────────────────────────────┐
│ Web (PWA)    │   │  api (Express)                                │
│ /app /desk   │◀─▶│  · auth (Google OAuth + JWT + desk PIN)        │
│ /cabin /lab  │WS │  · tenancy guard (org_id from JWT, RLS-bound)  │
│ /tv  /b/:s   │◀─▶│  · queue-engine (state machine + ETA EWMA)     │
└──────────────┘   │  · ai (Gemini: intent, vision, audio)          │
                   │  · billing (UPI QR, Razorpay, plans)           │
                   │  · media (reports, PDFs, TV voice packs)       │
                   └──────┬───────────────────────┬────────────────┘
                          │                       │
                   ┌──────▼──────┐        ┌───────▼────────┐
                   │ Supabase    │        │ Redis (queue,  │
                   │ Postgres+RLS│        │ pubsub, locks) │
                   │ Storage(S3) │        └────────────────┘
                   └─────────────┘
```

**Realtime:** Supabase Realtime (Postgres changes) for `/desk` + `/tv`; **Socket.IO** for the desk↔TV pairing channel and instant "someone else is calling" locks. No polling anywhere.

**Repo layout**
```
baari/
├─ apps/
│  ├─ api/            # Express
│  │   ├─ src/routes/{auth,org,queue,providers,services,patients,lab,billing,tv,public}.js
│  │   ├─ src/middleware/{auth,tenant,rls,rateLimit,pin}.js
│  │   ├─ src/services/{queueEngine,eta,ai,wa,lab,billing,pdf,tts}.js
│  │   └─ src/jobs/{reminders,recall,reviews,tvHeartbeat,failover}.js
│  ├─ wa-gateway/     # Baileys + Meta Cloud API adapter
│  └─ web/            # public/ — /desk /cabin /tv /app /lab /b/:slug (PWA)
├─ packages/shared/   # zod schemas, label dictionary, message templates
├─ supabase/migrations/
└─ scripts/{seed,voicepacks,standee-pdf}.js
```

---

## 2. Multi-tenancy: the rules that must not be broken

1. **Every tenant-owned table has `org_id uuid not null`.** No exceptions, no exceptions for "small" tables.
2. **RLS on, always.** Every request sets `set local app.current_org = '<org_id>'` inside a transaction; policies read `current_setting('app.current_org')::uuid`. The service-role key is used **only** by jobs and the wa-gateway, never by request handlers.
3. `org_id` **always** comes from the verified JWT claim, **never** from a URL param or body. A route like `/api/org/:id/...` must verify `:id === jwt.org_id`.
4. Desk/cabin sessions carry `role`, `provider_id?`, `scope: ['queue']` — a desk token is **structurally incapable** of reading revenue or patient history.
5. **Storage** buckets are `tenant/{org_id}/...` with per-tenant signed URLs (60 s). Lab reports live in a private bucket; only signed URLs are ever sent, never public links.
6. **Onboarding creates a Postgres schema-agnostic tenant row + a Supabase auth org**; cross-tenant admin panel operates via a separate service role with audit logs, and *raw patient data is masked* by default.
7. **Offboarding:** one endpoint exports everything (CSV+PDF zip) and one deletes everything (cascade + storage purge + session revoke) — required by DPDP.

---

## 3. Supabase schema (v1)

```sql
-- ── tenancy ────────────────────────────────────────────────────────────────
create table orgs (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,                      -- 'dr-sharma-dental'
  mode text not null check (mode in ('clinic','lab','salon')),
  name text not null,
  city text, area text, address text, maps_url text,
  phone text, logo_url text,
  locale text default 'hi',                       -- hi | pa | en | hinglish
  hours jsonb default '{}',                       -- {mon:{open:'09:00',close:'20:00',break:['14:00','16:00']},...}
  plan text not null default 'pilot',             -- pilot|start|growth|pro|hospital
  trial_ends_at timestamptz,
  wa_lane text default 'baileys',                 -- baileys | meta | both
  settings jsonb default '{}',                    -- tv_skin, review_link, two_ahead_threshold, etc.
  created_at timestamptz default now()
);

create table org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','manager','desk','provider')),
  provider_id uuid,                                -- for role='provider'
  desk_pin_hash text,                              -- 4-digit PIN, bcrypt
  active boolean default true,
  unique (org_id, user_id)
);

create table providers (                           -- doctor | stylist | phlebotomist
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null, specialty text, room text,   -- 'Cabin 1' | 'Chair 2'
  avg_minutes int default 10,
  days_off int[] default '{}',                     -- 0=Sun
  active boolean default true
);

create table services (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  provider_id uuid references providers(id) on delete set null,
  name text not null, price numeric(10,2) default 0,
  duration_min int default 15, category text, active boolean default true
);

-- ── patients (per-tenant, never global) ────────────────────────────────────
create table patients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  phone_e164 text not null, name text,
  locale text, dob date, notes text,
  consent jsonb default '{"wa":true,"marketing":false}',
  last_visit_at timestamptz, visits int default 0,
  blocked boolean default false,                   -- STOP
  created_at timestamptz default now(),
  unique (org_id, phone_e164)
);

-- ── the queue ──────────────────────────────────────────────────────────────
create table tokens (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  patient_id uuid references patients(id) on delete set null,
  provider_id uuid references providers(id),
  day date not null default (now() at time zone 'Asia/Kolkata')::date,
  number int not null,
  state text not null default 'BOOKED'
    check (state in ('BOOKED','ARRIVED','CALLED','IN_CONSULT','DONE','SKIPPED','HOLD','CANCELLED')),
  source text default 'walkin',                    -- walkin|whatsapp|web|phone|emergency
  reason text, service_id uuid references services(id),
  scheduled_for timestamptz, eta_at timestamptz,
  checked_in_at timestamptz, called_at timestamptz, done_at timestamptz,
  priority int default 100,                        -- emergency = 0
  alerts_sent jsonb default '{}',                  -- {'two_ahead':'2026-10-29T12:31Z'}
  created_by uuid, created_at timestamptz default now(),
  unique (org_id, provider_id, day, number)
);
create index on tokens (org_id, day, state, priority);

create table queue_events (                        -- audit + analytics, append-only
  id bigserial primary key,
  org_id uuid not null, token_id uuid, provider_id uuid,
  type text not null,                              -- issued|called|done|skipped|delay|emergency|hold
  payload jsonb, actor_id uuid, created_at timestamptz default now()
);

-- ── whatsapp ───────────────────────────────────────────────────────────────
create table wa_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  lane text not null,                              -- baileys | meta
  phone_e164 text, status text default 'pending',  -- pending|connected|disconnected|banned
  creds_enc bytea,                                 -- AES-GCM, KMS-wrapped
  meta jsonb,                                      -- waba_id, phone_number_id (encrypted token)
  last_seen_at timestamptz, health jsonb
);

create table messages (
  id bigserial primary key,
  org_id uuid not null, patient_id uuid, direction text,
  lane text, wa_message_id text, template text,
  body text, media_url text, status text,
  tokens_used int, cost_inr numeric(8,3), created_at timestamptz default now()
);

-- ── lab ────────────────────────────────────────────────────────────────────
create table prescriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  patient_id uuid references patients(id),
  media_url text, vision_json jsonb, confidence numeric(3,2),
  status text default 'new',                       -- new|quoted|booked|collected|reported
  quoted_total numeric(10,2), fasting_hours int,
  created_at timestamptz default now()
);

create table collections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  prescription_id uuid references prescriptions(id),
  patient_id uuid references patients(id),
  technician_id uuid references providers(id),
  slot_start timestamptz, slot_end timestamptz,
  geo_lat numeric(9,6), geo_lng numeric(9,6), address_text text,
  status text default 'scheduled',                 -- scheduled|assigned|collected|reported|cancelled
  report_url text, reported_at timestamptz
);

-- ── billing ────────────────────────────────────────────────────────────────
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  plan text not null, amount_inr numeric(10,2), period text default 'monthly',
  razorpay_sub_id text, upi_vpa text, status text default 'active',
  current_period_end timestamptz
);
create table payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, kind text,                 -- setup|amc|pilot|addon
  amount_inr numeric(10,2), method text,           -- upi_qr|razorpay|cash
  ref text, status text default 'pending', paid_at timestamptz,
  gst_invoice_no text
);

-- ── reviews / recall ───────────────────────────────────────────────────────
create table feedback (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, patient_id uuid, token_id uuid,
  rating int check (rating between 1 and 5), comment text,
  routed_public boolean default false, created_at timestamptz default now()
);
create table recalls (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, patient_id uuid, service_id uuid,
  due_at date, sent_at timestamptz, outcome text            -- booked|declined|no_reply
);
```

**RLS pattern (repeat for every tenant table):**
```sql
alter table tokens enable row level security;
create policy tenant_isolation on tokens using (
  org_id = current_setting('app.current_org', true)::uuid
);
```

---

## 4. API surface (v1)

```
POST   /api/auth/google                 # id_token → JWT {org_id, role}
POST   /api/auth/desk-pin              # {org_slug, pin} → scoped desk token
POST   /api/org                        # onboarding: create tenant (mode, name, area…)
PATCH  /api/org                        # settings, hours, tv skin
POST   /api/org/wa/session             # start Baileys QR → returns pairing QR (SSE)
GET    /api/org/wa/health              # lane status, warm-up day, ban risk
POST   /api/org/wa/meta                # official lane credentials (encrypted)

GET    /api/providers                  POST/PATCH/DELETE
GET    /api/services                   POST/PATCH/DELETE

GET    /api/queue/today?provider=       # desk + tv snapshot
POST   /api/queue/walkin               # {name?, phone?, provider_id, reason?} → token
POST   /api/queue/:id/call             # idempotent 5s lock
POST   /api/queue/:id/done
POST   /api/queue/:id/skip
POST   /api/queue/:id/hold             # {minutes}
POST   /api/queue/emergency            # {provider_id, label?} → priority 0 + broadcast
POST   /api/queue/delay                # {provider_id, minutes}
POST   /api/queue/:id/arrived
GET    /api/queue/eta/:id              # public (rate-limited, token-scoped)

POST   /api/lab/prescription           # multipart image → vision_json + quote
POST   /api/lab/quote/:id/send
POST   /api/lab/collection             # {slot, geo} → assign technician
POST   /api/lab/report/:id/upload      # pdf → WhatsApp delivery
GET    /api/lab/inbox

POST   /api/tv/pair                    # {code} → tv token (read-only)
GET    /api/tv/:orgSlug/state          # public, no PII (token, first name, room)
GET    /api/tv/:orgSlug/stream         # SSE/WS
POST   /api/tv/heartbeat

POST   /api/billing/pilot               # ₹1,500 → UPI intent + QR image
POST   /api/billing/checkout            # Razorpay order
POST   /api/webhooks/razorpay
GET    /api/billing/invoice/:id.pdf

POST   /api/public/:slug/join           # web booking (no auth, rate-limited, captcha)
GET    /api/public/:slug/slots
```

**Websockets:** `org:{org_id}:queue` (desk/cabin/tv), `org:{org_id}:desk-claims` (call-next locks).

---

## 5. Queue engine — implementation notes

```js
// services/queueEngine.js  (sketch)
async function callNext(orgId, providerId, actorId) {
  return db.tx(async t => {
    await t.none(`select pg_advisory_xact_lock(hashtext($1))`, [`${orgId}:${providerId}`]);
    const next = await t.oneOrNone(`
      select * from tokens
       where org_id=$1 and provider_id=$2 and day=current_date
         and state in ('ARRIVED','BOOKED')
       order by priority asc, number asc
       limit 1 for update`, [orgId, providerId]);
    if (!next) return { empty: true };
    await t.none(`update tokens set state='CALLED', called_at=now() where id=$1`, [next.id]);
    await t.none(`insert into queue_events(org_id,token_id,provider_id,type,actor_id)
                  values($1,$2,$3,'called',$4)`, [orgId, next.id, providerId, actorId]);
    return next;
  }).then(async token => {
    await Promise.all([
      tv.broadcast(orgId, { type: 'CALLED', token: token.number, room: token.room }),
      wa.enqueue(orgId, token.patient_id, 'called', { token: token.number }),
      eta.recompute(orgId, token.provider_id),          // → triggers two-ahead check
    ]);
    return token;
  });
}
```
**ETA:** EWMA with α=0.3 over the last 10 `done→called` deltas for that provider × time-of-day bucket (morning/afternoon/evening), clamped to `[0.5×, 2×]` the configured `avg_minutes`. Store on the token as `eta_at` so the TV and WhatsApp always agree.
**Idempotency:** advisory lock + a 5 s in-memory guard keyed by `org:provider`; the second `call` returns the first result.
**Two-ahead:** after every `done`/`call`/`skip`/`delay`, recompute positions and enqueue alerts where `position_ahead <= settings.two_ahead_threshold (default 2)`.

---

## 6. Gemini usage (three calls only, all cheap)

| Use | Model | Input | Output | Guard |
|---|---|---|---|---|
| Intent + slots | `gemini-2.5-flash` | text **or native audio** (voice note, no STT step) | strict JSON (schema above) | temperature 0.2, JSON mode, validate with zod, retry once |
| Prescription OCR | `gemini-2.5-flash` | image + catalogue JSON | `[{test, confidence, note}]` | reject < 0.55; require staff confirm < 0.85 |
| Report summariser | `gemini-2.5-flash` | lab values table | one neutral sentence + flags | **hard rule: no diagnosis, no medicine** |

**Never** use the LLM for: composing numbers/prices/times, TTS at announce time (use pre-generated packs), or anything a state machine can answer.
All calls are per-tenant rate-limited and logged to `messages(tokens_used, cost_inr)` so you can prove unit economics per clinic.

---

## 7. WhatsApp gateway

**Baileys (default lane)**
```js
// apps/wa-gateway/src/session.js
makeWASocket({
  auth: useMultiFileAuthState(`./sessions/${orgId}`),   // per-tenant isolation
  printQRInTerminal: false,
  browser: ['Baari', 'Chrome', '1.0'],
  markOnlineOnConnect: false,
  generateHighQualityLinkPreview: false
})
// events → credential persistence (encrypted), QR over SSE, message upsert → BullMQ
```
- Persist creds **encrypted** (AES-256-GCM, key from env/KMS) in `wa_sessions.creds_enc`, and restore on restart so a VPS reboot doesn't force a re-scan.
- One process per N tenants (start with 25/process), each with its own auth dir; on `401` → mark `disconnected`, alert owner, offer Meta failover.
- **Throttle layer** (per session): min 3 s gap, jitter to 12 s, ≤1 msg/3 s burst, daily caps by warm-up day, 21:00–08:00 hold.
- Media: PDFs sent as documents with a caption, images as compressed JPEG (≤1 MB).

**Meta Cloud API (failover / add-on):** store `phone_number_id` + token encrypted; send the same 11 templates; webhook verifies `X-Hub-Signature-256`; on Baileys `401` or a failed send, the queue job retries on the Meta lane automatically when `wa_lane='both'`.

**Normalised message shape** (both adapters emit this):
```js
{ orgId, lane, waMessageId, from, type: 'text|audio|image|location|button',
  text?, mediaUrl?, geo?, buttonId?, timestamp, raw }
```

---

## 8. TV display — implementation notes

- **Single static HTML file** (+ service worker). No framework, no build. `GET /tv/:orgSlug` → 2 KB HTML, one JS bundle <40 KB, one CSS <8 KB. Fonts self-hosted woff2 (subset).
- **Auth:** none. Pair by 6-digit code → sets a read-only cookie scoped to that org. Public state payload contains: token number, first name (or initial), room, provider display name, `updated_at`. **No phone, no full name, no reason, no diagnosis.**
- **Transport:** SSE (simplest, survives proxies) with WebSocket upgrade if available; 15 s heartbeat; exponential reconnect.
- **Announcements:** pre-generated MP3 packs `voice/{lang}/{n}.mp3` (1–500) + `voice/{lang}/phrases/*.mp3` served from `/media`; queue announcements so they never overlap; duck the background music if the clinic uses one (they won't, but support it).
- **Resilience:** IndexedDB caches last state + the audio manifest; if offline > 60 s, show a subtle `⟳` and keep announcing the last known called token once. Auto-reload the page at 4 AM daily (cheap memory hygiene on cheap Android TVs).
- **Multi-screen:** `?screen=2` selects which cabins to render.

---

## 9. What gets built next turn (v0 runnable in this workspace)

| Module | Scope in v0 |
|---|---|
| `api` | Express + Supabase client, Google OAuth stub (dev login), tenant middleware, full queue routes, ETA engine, TV state/SSE endpoints, walkin/call/done/skip/emergency/delay |
| `wa-gateway` | Baileys adapter with QR-over-SSE + a **mock lane** so the whole flow is demoable without a real phone |
| `ai` | Gemini intent + vision adapters with a **deterministic mock** fallback (no API key needed to run) |
| `web` | `/desk`, `/cabin`, `/tv/:slug`, `/b/:slug`, `/app` (static, no build step) — real, styled, Hinglish copy |
| `db` | `supabase/migrations/0001_init.sql` (schema above) + `scripts/seed.js` (demo clinic, 6 tokens, 3 doctors) |
| Not in v0 | Razorpay live keys, Meta lane, PDF report generation, voice packs (script provided) |

Run: `docker compose up` (Postgres + Redis) → `npm run migrate && npm run seed` → `npm run dev` → open `http://localhost:3000/desk`. Everything renders and the queue actually works end-to-end with the mock lane.

---

## 10. The Google Antigravity build prompt

Paste this whole block into Antigravity as the project brief (it is written as an agent contract, not a wish list):

```
PROJECT: "Baari" — multi-tenant WhatsApp-first clinic/lab/salon front-desk platform for India.
Read these spec files first and treat them as the source of truth:
  01-brand-book.md, 02-onboarding-and-ux-spec.md, 03-pricing-and-sales-playbook.md,
  04-whatsapp-bot-spec.md, 05-build-plan.md

NON-NEGOTIABLE CONSTRAINTS
1. Node 22 + Express. Postgres via Supabase. No ORM heavier than `pg` + SQL files.
2. Multi-tenancy: every tenant table has org_id; RLS enabled; org_id ONLY from the verified
   JWT. Service-role key must never appear in a request-path module. Add a lint rule that
   fails the build if `service_role` is imported under src/routes or src/middleware.
3. Frontend for /desk, /cabin, /tv, /b/:slug, /lab: plain HTML+CSS+ES modules, no build step,
   no framework, total JS budget per page 60 KB gzipped. /tv must work on Android TV Chrome 90.
4. All UI copy in Hinglish with an i18n dictionary (hi, pa, en). Mode switcher (clinic|lab|salon)
   drives a single label dictionary — never hardcode "Patient" in a template.
5. AI: gemini-2.5-flash only, 3 call sites (intent, prescription vision, report summary).
   Strict JSON output validated with zod. The LLM NEVER produces token numbers, prices or times.
   Deterministic mocks required so the app runs with zero API keys.
6. WhatsApp: adapter interface with two implementations — Baileys (per-tenant auth dir,
   encrypted credential persistence, throttle + warm-up) and Meta Cloud API. Normalised
   message envelope. Automatic failover. A `mock` implementation for local dev.
7. Every mutating queue route must be idempotent (pg advisory lock + 5s guard) and write a
   queue_events row. Undo endpoint within 60s for every desk action.
8. /tv payload must contain no PII: token number, first name/initial, room, provider name only.
9. All money paths: direct UPI QR (dynamic amount) + Razorpay orders; webhook signature
   verification; GST invoice PDF; no card data ever touches the app.
10. Tests: unit tests for queueEngine (ordering, priority, delay, no-show, concurrent call),
    eta (EWMA), and the intent JSON validator. Integration test that walks
    "walk-in → 2-ahead alert → call → done → review" against the mock lanes.

DELIVERY ORDER (commit after each, keep main green)
 M1 schema+migrations+seed+mock tenant
 M2 auth (Google OAuth + desk PIN) + tenant middleware + RLS proof test
 M3 queue engine + /desk UI (4 buttons) + undo + realtime
 M4 /tv display + pairing + SSE + audio announce from voice packs
 M5 wa-gateway (mock → Baileys) + intent pipeline + token/alert/reminder flows
 M6 /app owner home + /b/:slug public booking + onboarding wizard (8 steps)
 M7 lab module (vision quote → collection → report delivery)
 M8 billing (UPI QR + Razorpay) + invoice PDF + plan gating
 M9 recall + review shield + jobs (cron) + admin panel
 M10 hardening: rate limits, DPDP export/delete, observability, load test

ACCEPTANCE
- A non-technical user can go from signup to a live token in under 7 minutes without help.
- "Call Next" appears on the TV in < 1.5 s over a 3G connection.
- Killing the API process does not corrupt queue state; restart resumes correctly.
- Two receptionists tapping Call Next simultaneously produce exactly one CALLED token.
- Every desk action is reversible for 60 s.
```

---

## 11. Risks & how the architecture absorbs them

| Risk | Mitigation built into the design |
|---|---|
| **Baileys number ban** (a tenant loses their WhatsApp) | Meta lane failover, warm-up caps, no unsolicited blasts, opt-out table, session health dashboard, and a written promise in the MSA that the clinic's number is theirs. |
| **DPDP Act 2023 / patient data** | Per-tenant isolation + RLS, private storage with signed URLs, consent flags per patient, export/delete endpoints, no ads to patients, no cross-tenant data, audit log on every PHI read. |
| Clinic internet down | Offline queue on `/desk`, cached `/tv`, printed slips, SMS fallback. |
| Doctor doesn't press Done | Auto-close after 2× avg, ETA decay adjusted from `called→done` observations, gentle prompt. |
| Tablet too old | 60 KB page budget, no framework, SSE not WS-only, no external CDN. |
| Churn after pilot | Day-3 report message, review-shield value, time-to-first-token nudge at +4h/+20h. |
| Price war with Practo | We don't sell practice management; we sell the front desk + hardware replacement. Different budget line, different buyer. |
