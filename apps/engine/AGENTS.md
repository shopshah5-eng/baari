# AGENTS.md — Baari build brief

You are working on **Baari**, a production-bound, multi-tenant, WhatsApp-first front office
for Indian clinics, diagnostic labs and salons. This repo is a **working platform** (34 tests
green), not a prototype. Read this file first, then `README.md`, then `PLATFORM-EXPLAINED.md`.

---

## 0. Ground rules (do not break these)

1. **The AI understands, the code decides.** `src/ai.js` classifies intent and extracts slots.
   It must never produce a token number, price, time, or state transition. Those come from
   `src/queue.js` + `src/eta.js`. If you add a feature where a model output reaches a patient,
   it must pass through a deterministic composer.
2. **Per-provider queues only.** Never introduce a global token counter or a global queue
   position shown to a patient. A patient only ever sees their own provider's line.
3. **Guardrails live in `wa.send()` / `wa-gateway.deliver()`.** Opt-out, quiet hours (21:00–08:00
   IST), daily caps, warm-up caps, 3–12 s human jitter and the 72-hour free-lane silence rule
   must never be bypassed by a caller. If you add a message type, route it through `wa.send()`.
4. **`org_id` comes from the verified JWT claim, never from a URL or body.** See `src/auth.js`
   `context()`. In production `AUTH_REQUIRED=true`.
5. **No clinical advice, ever.** `src/lab.js` may state in-range / out-of-range and must route
   any abnormal value to "doctor se milein". No diagnosis, no severity, no medicine names.
6. **Review policy compliance.** The Google review link is offered to **every** rating and a
   private channel to every rating. Never restore rating-gating — it can get a clinic's Google
   Business Profile suspended.
7. **Hinglish-first copy.** Every patient-facing string is Hindi/Hinglish, warm, second person.
   Never show `SaaS`, `dashboard`, `API`, `workflow`, `success: 200` to a user.
8. **Every desk action is idempotent and undoable for 60 s.** Advisory lock + idempotency key.
9. **Tests are a gate.** `npm test && npm run test:sql` must stay green. Add a test with every
   engine change. Current: 26 + 8.

---

## 1. What already works (do not rebuild)

| Area | Files | Status |
|---|---|---|
| Per-provider queue engine, states, priority, emergency, delay, undo | `src/queue.js` | complete |
| ETA windows, service durations, EWMA learning, travel time, leave-by | `src/eta.js` | complete |
| WhatsApp bot: book, status, price, KB answers, ratings, staff commands, lab flow | `src/bot.js` | complete |
| Baileys lane (per-tenant session, encrypted creds, QR over SSE) + Meta failover | `src/wa-gateway.js` | wired, **unpaired** |
| Grounded retrieval + escalation | `src/kb.js` | complete (BM25-lite; see M3) |
| Lead CRM, 6 revenue metrics, follow-up ladder, monthly report | `src/leads.js` | complete |
| Review engine, ask-once ledger, private low-rating alert | `src/review.js` | complete |
| Lab: prescription quote → collection → report PDF → verify page | `src/lab.js` | complete |
| Billing: UPI intent/QR, Razorpay orders, signed webhook, GST invoice PDF | `src/billing.js` | complete (no live keys) |
| Auth: Google OAuth, HS256 JWT, scrypt desk PIN, role scopes | `src/auth.js` | complete |
| SSE realtime, rate limiting, security headers, idempotency | `src/realtime.js`, `src/security.js` | complete |
| 12-question self-serve setup chat | `src/setupflow.js`, `public/setup.html` | complete |
| Operator console, DPDP export/delete, print-asset PDFs, Docker/PM2/systemd | `src/routes/admin.js`, `src/routes/dpdp.js`, `scripts/` | complete |
| Production Postgres schema + RLS + queue functions | `supabase/migrations/0001_init.sql` | written, tested in pg-mem |

---

## 2. Your build queue (in order — ship each before starting the next)

### M1 — Runtime Postgres switch  ← highest priority
The schema exists and is tested, but the server still runs on `data/db.json`.
- Add `src/store-sql.js` implementing the same surface as `src/store.js` (org, providers,
  services, patients, lead, tokensToday, event, id/save helpers) on `pg` + `withTenant()`.
- Select via `STORE=sql` (default `json` so the demo keeps working with no database).
- Wrap every request in `withTenant(conn, ctx.orgId, …)` so **RLS** does the isolation.
- Acceptance: `npm test` still green on both stores; a scripted run of the full patient journey
  against Postgres produces identical output to the JSON store.

### M2 — Real WhatsApp pairing + session durability
- `POST /api/:slug/wa/connect` already starts Baileys and streams the QR. Verify on a real number.
- On boot, restore every tenant with stored `creds_enc` (`wa_sessions.creds_enc`) and reconnect.
- Acceptance: restart the process → session reconnects without a re-scan; killing the network
  mid-send queues and retries; `loggedOut` fires the owner alert and Meta failover.

### M3 — Retrieval upgrade
Replace the BM25-lite in `src/kb.js` with `pgvector` + Gemini embeddings (`kb_docs.embedding`
already in the schema). Keep the same escalation threshold behaviour and the number-grounding
validator. Acceptance: a price question whose answer is absent still escalates.

### M4 — Billing live
- Razorpay checkout on the client for `method=razorpay` (order id already returned).
- UPI QR is already rendered server-side; add a "payment received" webhook path for your PSP
  or keep manual confirm in `/billing`.
- Acceptance: a real ₹1 test payment produces a paid `payments` row and a GST invoice PDF.

### M5 — Voice notes end-to-end
`src/ai.js` already accepts native audio at the Gemini call site. Add: download the Baileys
audio message → base64 → `classify()` → same slot extraction. Never add a separate STT step.

### M6 — Hardening
Per-tenant Gemini budget, `messages.cost_inr` accounting, log shipping, Sentry, offline queue
on `/desk`, `/api/health` uptime probe, daily backup job.

---

## 3. Conventions

- **Node 20+**, Express 4, plain HTML/CSS/ES modules on the front end. **No build step, no
  framework.** Budget: 60 KB gzipped JS per page.
- **Hinglish copy**, i18n keys live in the templates today; if you add a locale, keep `hi` default.
- **Tests** are plain Node (`node src/test.js`), no test framework. Use the `t(name, fn)` helper.
- **Never** commit `.env`, `data/db.json`, `data/sessions`, `node_modules`.
- Money is always INR, GST 18%, quoted ex-GST and shown inclusive on the invoice.
- PDFs use `pdfkit` and must be written with the `finish()` helper (await the stream) — the
  sync-chunk mistake is already fixed once; don't reintroduce it.

---

## 4. Environment

```bash
cp .env.example .env
# required for production:
#   PUBLIC_URL, JWT_SECRET, AUTH_REQUIRED=true, ADMIN_KEY, UPI_VPA
# optional:
#   GEMINI_API_KEY (blank = deterministic mock), DATABASE_URL, RAZORPAY_*,
#   GOOGLE_CLIENT_ID/SECRET, WA_LANE, WA_ENC_KEY
npm install
npm start          # http://localhost:3000
npm test           # 26 tests
npm run test:sql   # 8 schema tests
npm run assets     # print kit PDFs
```

---

## 5. Definition of done for the business

A clinic owner can sign up, answer 12 WhatsApp questions, connect their number, and have a real
patient receive a real token — in under 10 minutes, with no engineer involved. Money lands via
UPI QR, the GST invoice is automatic, and the monthly report goes out on its own.

If a change does not move that sentence forward, question whether it belongs in this sprint.
