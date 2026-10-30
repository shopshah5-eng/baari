# Deploying Baari

Three paths. Pick one; all of them end with the same env file.

---

## 1. The 10-minute path (single VPS, Docker)

```bash
git clone <repo> /opt/baari && cd /opt/baari
cp .env.example .env && nano .env        # set PUBLIC_URL, JWT_SECRET, GEMINI_API_KEY
docker compose up -d --build
docker compose logs -f baari             # should print "🟢 Baari running"
```

`deploy/Caddyfile` gets you automatic HTTPS. Change `baari.clinic` to your domain first.
Point an A record at the VPS, open ports 80/443, done.

## 2. Without Docker (PM2)

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
cd /opt/baari && npm ci --omit=dev
pm2 start deploy/ecosystem.config.js && pm2 save && pm2 startup
```

`deploy/baari.service` is the systemd equivalent if you prefer that.

## 3. Supabase / managed Postgres

```bash
export DATABASE_URL="postgres://user:pass@db.xxx.supabase.co:5432/postgres"
npm run migrate          # applies supabase/migrations/0001_init.sql
npm run migrate -- --mem # dry-run in memory, prints every statement
```

The migration enables RLS on every tenant table with a `current_setting('app.current_org')`
policy, plus `call_next()` and `recompute_eta()` SQL functions.
**Verify RLS with a scoped role before trusting it:**

```sql
begin;
  select set_config('app.current_org', '<org-a-uuid>', true);
  select count(*) from tokens;   -- must never include org B's rows
rollback;
```

---

## Environment

| Key | Why | Required |
|---|---|---|
| `PUBLIC_URL` | deep links in WhatsApp (status page, review redirect, QR) | **yes** |
| `JWT_SECRET` | signs owner/desk tokens | **yes** (generate: `openssl rand -hex 32`) |
| `GEMINI_API_KEY` | live intent/vision; blank = deterministic mock | no |
| `WA_LANE` | `mock` \| `baileys` \| `both` | no |
| `WA_ENC_KEY` | encrypts Baileys credential backup | recommended |
| `ADMIN_KEY` | protects `/api/admin/*` and `/admin` | **yes in production** |
| `AUTH_REQUIRED` | `true` enforces login (set this in production!) | **yes** |
| `GOOGLE_CLIENT_ID` / `SECRET` | Google login | for owner login |
| `DATABASE_URL` | Postgres; blank = JSON store | no |
| `RAZORPAY_KEY_ID` / `SECRET` | card/netbanking; UPI QR works without them | no |
| `UPI_VPA` / `UPI_PAYEE_NAME` | where the money lands | **yes** |

## Production checklist

- [ ] `AUTH_REQUIRED=true` and `ADMIN_KEY` set (the demo mode is a foot-gun in prod)
- [ ] `JWT_SECRET` and `WA_ENC_KEY` are 32+ random bytes, not the defaults
- [ ] HTTPS live (WhatsApp QR, geolocation and clipboard all need it)
- [ ] `data/` on a persistent volume — it holds the WhatsApp sessions and PDFs
- [ ] **One instance per host.** Baileys sessions are stateful; do not load-balance across replicas
- [ ] Daily backup: `data/db.json` or a Postgres dump, plus `data/sessions`
- [ ] Uptime check on `/api/health`
- [ ] Run `npm run test:all` before every deploy

## Scaling notes

* 1 process handles ~200–300 tenants of queue traffic comfortably (the queue engine is in-memory + O(1) per action).
* Baileys is the first bottleneck, not the API: budget **25 sessions per process**, then shard by tenant hash.
* The TV and desk use SSE; behind nginx add `proxy_buffering off;` for `/api/*/stream`.
* Move the cron jobs (`src/jobs.js`) to BullMQ + Redis before you run more than one process for the *same* tenant.

## What to do when WhatsApp breaks (it will)

| Symptom | Action |
|---|---|
| `status: disconnected` in `/desk` | Owner rescans QR from `/desk` → WhatsApp button. Creds are restored from disk, so most restarts need no scan |
| `loggedOut` (401) | Number was logged out from the phone. Re-pair; if it repeats, the tenant is misusing the number (bulk blasts) — check `messages` for volume spikes |
| Messages fail but session is `connected` | Meta lane takes over automatically if configured (`/desk` → Meta lane) |
| Delivery slow | Check warm-up caps in `src/wa-gateway.js` (`warmupCap`) — a new number is deliberately limited |
