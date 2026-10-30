# BUILD-TRACKER.md — Baari Build & Governance Tracker

Last Updated: 2026-10-30 19:15 IST
Platform: Google Antigravity / Monorepo

---

## 1. Live Deployment & Repo Status

- **GitHub Repository**: [https://github.com/shopshah5-eng/baari](https://github.com/shopshah5-eng/baari)
- **Vercel Production URL**: [https://baari-inky.vercel.app](https://baari-inky.vercel.app)
- **Latest Deployment**: [https://baari-phm03q4xb-taj-s-projects1.vercel.app](https://baari-phm03q4xb-taj-s-projects1.vercel.app)
- **Deployment Security Audit**: `node scripts/audit-deploy.js` → **13 passed · 0 warnings · 0 critical** (100% Green)
- **Engine Local Endpoint**: `http://localhost:3000` (API v2 at `/api/v2`)
- **Web Local Endpoint**: `http://localhost:3001` (Next.js 15.3.9 App Router, 23 routes)

---

## 2. Phase Gates Ladder

| Phase | Description | Status | Gate Command | Gate Result |
|---|---|---|---|---|
| **Phase 0** | Foundation: Monorepo, TS, Postgres migration, RLS two-tenant isolation | ✅ PASS | `npm run gate:0` | 26 unit + 8 SQL + isolation pass |
| **Phase 1** | Queue Loop: Desk, Cabin, TV, idempotent Call Next, SSE sync | ✅ PASS | `npm run gate:1` | Idempotent call-next, TV 14% token, cabin timer |
| **Phase 2** | Onboarding + Import: Conversational wizard, 7 import methods, preview card | ✅ PASS | `npm run gate:2` | Wizard step engine + extraction card |
| **Phase 3** | Knowledge + Learning: Grounded answers, escalation validator, EWMA timing | ✅ PASS | `npm run gate:3` | EWMA duration override after 5 samples |
| **Phase 4** | WhatsApp Official: Meta Embedded Signup state machine, honest status, guardrails | ✅ PASS | `npm run gate:4` | Quiet hours (21-08 IST), 72h rule, jitter |
| **Phase 5** | Patients & Reviews: Ask-once ledger, non-gated Google link, private alerts | ✅ PASS | `npm run gate:5` | Google link to 100%, alert on ≤3★ |
| **Phase 6** | Billing & Reports: Zero-MDR UPI QR, Razorpay webhook, GST invoice PDF | ✅ PASS | `npm run gate:6` | Invoice PDF generator + 6 revenue metrics |
| **Phase 7** | Hardening & North-Star: Docker compose, alarms, automated acceptance test | ✅ PASS | `npm run gate:7` / `npm run accept` | Scripted 12-step acceptance test harness (All 12 steps passed) |

---

## 3. Test Suites Baseline

- **Engine Unit Tests**: `node apps/engine/src/test.js` → **26 passed, 0 failed**
- **Postgres Schema & RLS Tests**: `node apps/engine/src/sql/test-sql.js` → **8 passed, 0 failed**
  - Tenant isolation verified under RLS: cross-tenant access blocked.
- **Frontend Production Build**: `npm --prefix apps/web run build` → **17 routes compiled, 0 errors**

---

## 4. Parked Ideas (§11 Change Control)

| Idea | Reason Parked | Re-entry Condition |
|---|---|---|
| Voice note audio transcription via separate STT | Non-goal: Gemini accepts native audio directly | Keep native audio input only |
| SMS fallback gateway for non-WhatsApp users | Phase 7 optional add-on | Awaiting tenant request |

---

## 5. System Status

- All Phase Gates `gate:0` through `gate:7`: **100% PASSING**
- North-Star Acceptance Test `npm run accept`: **12/12 Steps PASSED**
- All 34 Engine & SQL tests: **34/34 PASSED**
- GitHub & Vercel: **Deployed & Live**
