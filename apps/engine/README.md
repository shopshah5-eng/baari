# BAARI — WhatsApp-front-office platform (v0.9)

Zero-app WhatsApp appointment · live OPD token queue · multi-doctor ETA · lab prescription quotes · lead CRM + revenue · review engine · waiting-room TV.

**This is a running platform, not a prototype.** Every screen below hits real endpoints; the queue engine, ETA learning, bot, billing, lab reports and reviews all execute.

```bash
npm install
npm start                 # http://localhost:3000
npm test                  # 26 tests — engine, auth, billing, lab, DPDP
npm run test:sql          # 8 tests — production Postgres schema (pg-mem)
npm run assets            # print kit PDFs (standee · desk card · TV card)
npm run reset             # wipe demo data and reseed
```

No API keys required. Blank `GEMINI_API_KEY` → deterministic mock at the same call site.

---

## Screens

| | URL | What it proves |
|---|---|---|
| Home | `/` | Demo order, three tenants |
| WhatsApp | `/bot` | Booking, status, price, prescription photo, location pin, ratings, staff commands |
| Desk | `/desk` | 4 buttons, per-doctor queues, live SSE, undo, **WhatsApp connect panel with real QR** |
| Cabin | `/cabin` | One button (Done) — the learning loop |
| TV | `/tv` | Now-serving + Hindi/English announcement, no login |
| Leads | `/leads` | Pipeline · booked · collected · recovered · leakage |
| Lab | `/lab` | Prescription inbox → collection → report PDF → WhatsApp |
| Billing | `/billing` | Plans, UPI QR (zero MDR), Razorpay, GST invoice PDF |
| Owner | `/app` | Learning deltas, review stats, knowledge base, plan |
| Setup | `/setup` | 12 questions → live tenant, no human |
| Login | `/login` | Google OAuth + desk PIN |
| Operator | `/admin` | All tenants, MRR, churn risk, health (`ADMIN_KEY`) |
| Patient status | `/status?id=…` | Token, position, leave-by time |
| Report verify | `/verify/:id` | QR/footer verification page |

Seeded tenants: `dr-sharma` (clinic, 3 doctors, 12 consultations of history so the ETA has learned), `nova-lab`, `glam`. Switch with `?t=`.

---

## Architecture

```
public/*.html          static screens (SSE for live state, no build step)
src/server.js          Express: queue, bot, leads, KB, public pages
src/routes/            auth · billing · lab · wa · admin · dpdp · stream
src/queue.js           per-provider queues, call-next, emergency, delay, undo
src/eta.js             ETA windows, service durations, EWMA learning, travel time
src/wa-gateway.js      Baileys sessions (encrypted creds, warm-up, jitter) + Meta failover
src/bot.js             the conversation machine (intent → engine → templated copy)
src/kb.js              grounded retrieval; refuses below threshold
src/leads.js           CRM stages, 6 revenue metrics, follow-up ladder
src/review.js          policy-safe review engine, ask-once ledger
src/lab.js             prescription → collection → report PDF (no diagnosis)
src/billing.js         UPI intent/QR, Razorpay, signed webhooks, GST invoice
src/auth.js            Google OAuth, HS256 JWT, scrypt desk PIN
src/realtime.js        SSE hub
src/sql/               pg + pg-mem adapter, repository, schema tests
supabase/migrations/   the production schema + RLS + queue functions
scripts/               migrate · print-asset generator
deploy/                Caddyfile · PM2 · systemd
```

### The four ideas worth reading the code for

1. **Per-provider queues** (`eta.js`, `queue.js`) — there is no global "token 62". A patient only sees their own provider's position, so 3 doctors × 3 patients gives three different times with zero confusion. One doctor's overrun moves only their queue.
2. **ETA that learns** — durations come from the *service* (a 45-min RCT shifts 45 min), and actual `called → done` times feed an EWMA that overrides the configured average after 5 samples. Sub-2-minute clicks are ignored so a mis-tap cannot poison the average. Recompute is idempotent and rounded to the minute.
3. **Grounded answering** (`kb.js`) — below threshold the bot refuses and escalates, and a validator rejects any answer containing a number that isn't verbatim in the retrieved docs. A wrong "I don't know" is free; a wrong price is not.
4. **Guardrails in the sender** (`wa.js`, `wa-gateway.js`, `jobs.js`) — quiet hours, opt-out, warm-up caps, 3–12 s human jitter, and the 72-hour rule on the free lane are enforced before anything leaves the process.

### Review engine, zero Google API
The Google link goes to **every** rating (gating risks a suspended Business Profile) and a private owner channel is offered to everyone; any ≤3★ raises an instant alert. De-dup: once per visit, max 2 per 6 months, suppressed for recently-unhappy or opted-out patients. Link comes from Setup Q11 — one text field.

---

## Tests

`npm test` → **26 passing**: 10 queue/ETA cases from the spec, EWMA, ban-safety, opt-out, review de-dup, JWT tamper, desk-token scope, scrypt PIN, plan/GST maths, UPI intent, webhook signature, invoice PDF, lab report PDF, DPDP export/delete, validation, setup flow.

`npm run test:sql` → **8 passing** against the real migration in an in-memory Postgres: every table, per-provider numbering, idempotent `call_next`, unique/check constraints, tenant isolation arithmetic, billing rows.

---

## Production

See **[DEPLOY.md](DEPLOY.md)** — Docker/Caddy, PM2, Supabase migration with RLS verification, the production checklist, and the WhatsApp-breaks runbook.

Two honest limits of this build:

* **Storage defaults to `data/db.json`.** The Postgres schema, RLS policies, repository and tests are complete (`supabase/migrations`, `src/sql/`), but flipping the runtime from the JSON store to Postgres needs a real database to verify against — no Postgres exists in this environment. Single-node JSON is fine up to a few hundred tenants; migrate before multi-instance.
* **Baileys is wired but unpaired.** The session manager, QR-over-SSE, encrypted cred-backup, reconnect backoff and Meta failover all run, and `/desk` shows the live QR — but pairing requires scanning with a real phone, which cannot happen here. Until you scan, the mock lane keeps the whole product demoable.

Docs 01–10 in `docs/` are the strategy pack this build implements.
