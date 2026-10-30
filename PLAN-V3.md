# PLAN-V3.md — Governance, Gates & Handover

`MASTER-PROMPT.md` tells the agent what to build. This file tells the agent and you
how the build is governed: what is out of scope, what "done" means as a command,
what happens when a phase fails, what happens when Meta says no, and when you stop paying
attention. Read `BUILD-TRACKER.md` at the start of every new session.

---

## 0. The 12 Weaknesses This Fixes

| # | v2 weakness | v3 fix |
|---|---|---|
| 1 | 10 acceptance workflows, no single definition of "the business is live" | §1 North-star test — one scripted journey that must pass before anyone calls it done |
| 2 | No out-of-scope list; agents expand scope by default | §2 Non-goals — 15 things explicitly forbidden in v1 |
| 3 | Gates described in prose | §3 `npm run gate:<phase>` — a command that exits 0 or 1 |
| 4 | No failure protocol; agents thrash for 200 turns | §4 Fail-forward / fail-back / ask rules with a 3-attempt cap |
| 5 | Meta approval is the #1 kill risk, no deadline or fallback | §5 Risk register with trigger dates and pre-decided fallbacks |
| 6 | WhatsApp message cost never modelled against the price | §6 Cost guard — per-tenant message budget, overage, and a hard cap |
| 7 | Nothing says who sells while the build runs | §7 Parallel commercial track — revenue before Phase 7 |
| 8 | Agent context drifts across sessions | §8 Session protocol — 6 lines to paste, tracker updated at every stop |
| 9 | Demo tenants in `db.json` have no migration path | §9 Data migration rule — JSON→Postgres parity harness |
| 10 | No answer to "how do I know it broke before a patient tells me" | §10 Production watch — 5 alarms, owner-visible not log-visible |
| 11 | No change control; every brainstorm becomes a branch | §11 Change control — idea → parked, with a re-entry test |
| 12 | No exit criteria for you | §12 Handover — the 7 things that mean you no longer need the agent |

---

## 1. North-Star Acceptance Test

This is the only definition of "v1 is done". It must run in one command against a clean
database and produce a single pass/fail line plus artifacts:

```bash
npm run accept
```

### Scripted journey — Dr. Sharma's clinic, from zero:
1. A new owner signs up with Google. An empty org is created. No demo data visible.
2. Onboarding: owner types one paragraph of free text about the clinic. Baari extracts
   name, city, 2 doctors, 6 services, hours, and asks exactly 3 clarifying questions.
3. Owner uploads one real PDF price list. Preview appears; owner edits one price; approves.
4. Owner connects WhatsApp. Because approval is pending, the UI shows
   `pending_verification` — and the flow still completes, with a clearly labelled
   sandbox/test-number lane so the owner can proceed.
5. Patient messages in Hinglish "aaj shaam ko dikhana hai, bukhar hai". Bot books a token
   for Dr. Sharma, quotes an ETA window and a fee, and the fee matches the approved KB.
6. Reception desk: owner taps Call Next. TV updates within 2 s. Patient gets a WhatsApp
   "aapki baari" message. Calling twice does not issue two tokens.
7. Doctor marks Done. ETA engine learns one duration sample. The "Baari is Learning"
   panel shows it with sample count.
8. Patient rates 5★ → Google review link returned. Second patient rates 2★ → private owner
   alert, Google link still returned, and no second ask for 180 days.
9. Owner asks an unanswered question in the bot ("kya aap MRI karte hain?"). It escalates to
   an inbox with a suggested KB answer; owner approves it; the next identical question is
   answered from the KB and logged as a KB hit.
10. Owner pays ₹4,999 + ₹1,999 setup by UPI. Invoice `BAARI/2026/NNNN` PDF downloads.
11. Owner clicks Export my data → JSON + CSV. Owner clicks Delete → data gone, audit row stays.
12. Restart the engine mid-journey at step 6. Queue state, tokens and ETA are identical
    afterwards.

**Pass criteria**: all 12 steps, no manual DB edits, no 500s, no fabricated price anywhere
(a deliberately false question must still escalate), total runtime < 4 minutes.

---

## 2. Non-Goals (v1) — Forbidden Scope

The agent must not build these, and must not "prepare" for them by adding tables,
flags or abstractions. If asked, park them in §11.

1. Native mobile apps. PWA at most.
2. Multi-language UI beyond Hinglish/Hindi/English. No i18n framework in v1.
3. Custom domains / white-label per tenant.
4. Insurance, claims, ABDM/ABHA integration, e-prescriptions with drug names.
5. Teleconsultation (video/audio calls).
6. Inventory, pharmacy, or stock management.
7. Generic CRM ("custom objects", pipeline builders, formula fields).
8. Payroll, attendance, HR.
9. Marketplace / patient-side discovery app.
10. AI that writes clinical notes or suggests diagnoses.
11. Baileys or any unofficial WhatsApp transport in production paths. Dev lane only.
12. Rating-gated review requests. Never.
13. Microservices, Kubernetes, Kafka, event sourcing, CQRS. One Postgres, two deployables.
14. A second chart library or a design-system rewrite. shadcn defaults + one chart max.
15. Analytics dashboards for vanity metrics. Four KPI cards, one chart, that's it.
16. Anything requiring a paid third-party account other than Supabase, Razorpay, Gemini,
    Meta, and a mailer.

---

## 3. Gates as Commands

`scripts/gate.js` runs the checks for a phase and exits non-zero on any FAIL. A check that
cannot run yet reports SKIP — a SKIP is not a pass, and a phase cannot be signed off
with an unexplained SKIP.

```bash
npm run gate:0     # foundation (monorepo, types, 34 engine tests, RLS tenant isolation)
npm run gate:1     # queue loop (idempotent call-next, desk, cabin, TV realtime)
npm run gate:2     # onboarding + import
npm run gate:3     # knowledge grounding + EWMA timing
npm run gate:4     # official WhatsApp + webhook security
npm run gate:5     # patients, notifications & non-gated reviews
npm run gate:6     # billing & reports
npm run gate:7     # hardening & north-star acceptance
```

### Standard Layer Ladder:

| Layer | Check | Applies from |
|---|---|---|
| engine unit | `node src/test.js` (26 passing) | all |
| SQL schema | `node src/sql/test-sql.js` (8 passing) | all |
| live smoke | `node scripts/smoke.js` (API endpoints) | all |
| types | `tsc --noEmit` clean, no any in new code | 0 |
| lint | next lint + eslint clean | 0 |
| tenant isolation | two-org RLS test proving org A cannot read org B | 0 |
| queue parity | JSON store vs Postgres produce identical journey output | 1 |
| realtime | SSE delivers state change < 2 s across two clients | 1 |
| grounding | fabricated price/duration must escalate, never answer | 3 |
| webhook | forged X-Hub-Signature-256 → 400, zero state change | 4 |
| acceptance | `npm run accept` (north-star) | 7 |

**Rule**: the agent may not start phase N+1 until `gate:N` exits 0 and you have seen the output.
No "I'll fix it in the next phase."

---

## 4. When a Phase Fails — Protocol

- **3-attempt cap**: The same failing check may be attempted at most 3 times. Then STOP, write
  what was tried, what the error actually is, and what the two plausible causes are. Ask.
- **Fail forward** if the failure is in new surface (name a file that didn't exist yesterday).
- **Fail back** (revert the phase, not the whole build) if the failure touches a green test
  or a hard rule in `AGENTS.md`. A broken queue engine is never "acceptable for now".
- Never weaken a test, widen a threshold, add a try/catch that swallows, or mark a check
  skip to make a gate green. If a test is wrong, say why in one sentence and change the
  test in its own commit.
- **Rule of one**: one concern per commit, message = `phase-N: what and why`.
- **Red line**: any change to `queue.js`, `eta.js`, `bot.js` intent logic or the
  guardrails in `wa.send()` requires a new test in the same commit.

---

## 5. Risk Register

| # | Risk | Likelihood | Trigger to act | Pre-decided response |
|---|---|---|---|---|
| R1 | Meta Embedded Signup needs App Review / partner approval | High | no approval by start of Phase 4 | Ship the honest `pending_verification` state + a labelled test-number lane. Never fake it. Sell pilots on the desk + TV + bot-with-sandbox lane, not on "WhatsApp connected". |
| R2 | WhatsApp messaging cost eats margin | Medium | cost > 15% of plan MRR for a tenant | §6 budget guard: included-quota + overage + auto-downgrade to in-app/TV notifications. |
| R3 | Template approval rejected for wording | Medium | any template rejected twice | Fall back to a shorter utility template; escalate wording to you, not to the agent. |
| R4 | Supabase RLS leak between tenants | Low, fatal | any isolation test red | Freeze feature work. RLS test becomes a blocking gate. No exceptions, no "temporary service-role" path in web app. |
| R5 | Postgres store diverges from JSON store | Medium | parity test mismatch | Keep JSON store as the reference implementation; port behaviour, not behaviour-plus-improvements. |
| R6 | Gemini latency/cost per message | Medium | p95 reply > 6 s or > ₹0.30/msg | Cache KB answers, use a small model for classification, escalate only on low confidence. |
| R7 | Clinic owner won't finish onboarding | High | onboarding completion < 60% in pilots | Cut to 3 questions max before value is shown. Onboarding is measured, not assumed (§7). |
| R8 | Razorpay KYC/activation delay | Medium | not live by Phase 6 | UPI-intent QR already works with zero MDR — keep it as the shipping path; Razorpay is an addition, not a dependency. |
| R9 | Agent rewrites the engines and breaks them | Medium | engine tests drop below 26 | `AGENTS.md` rule 0. Engines are ported, never reimplemented. Revert the phase. |

---

## 6. Cost Guard (WhatsApp vs Price)

Utility/auth ≈ ₹0.1150 + 18% GST ≈ ₹0.136 per message; marketing ≈ ₹0.86 + GST ≈ ₹1.02.
A 40-patient clinic sends roughly 3 messages per patient (booked, turn-soon, done) ≈ 120/day
≈ 3,600/month ≈ ₹490/month. That is 25% of a ₹1,999 plan and 10% of a ₹4,999 plan.

Therefore:
- Every plan carries a message quota: Starter 2,000, Growth 6,000, Scale 15,000 / month.
- At 80% the owner sees one quiet in-app notice. At 100%, non-essential messages downgrade to
  the TV/app channel automatically (never drop a "your turn" alert).
- Marketing messages are opt-in only and never auto-sent.
- The admin panel shows cost per tenant and gross margin per tenant. A tenant below 60% margin
  is flagged.
- A daily cron posts one line to the owner's reports: messages sent, cost, remaining quota.

---

## 7. Parallel Commercial Track

The build is 9–11 weeks. Revenue does not have to be:

- **Weeks 1–2 (Phase 0–1)**: 30-clinic list in one city; 10 in-person visits with the desk + TV + bot demo on a laptop.
- **Weeks 3–4 (Phase 2–3)**: ₹1,000 adjustable pilot offer to 5 clinics. Pilot = real patients, real queue, real bot on a test number.
- **Weeks 5–6 (Phase 4–5)**: Convert 3 pilots to ₹4,999 + ₹1,999. Get written permission to use one as a case study.
- **Weeks 7–8 (Phase 6)**: Raise to 12 pilots; ask every pilot for 2 referrals. Price test: quote ₹6,999.
- **Weeks 9–11 (Phase 7)**: 8 paid tenants, ₹3.5L setup collected, ~₹45k MRR.

---

## 8. Session Protocol

```text
Read AGENTS.md, PLAN-V3.md and BUILD-TRACKER.md.
We are on phase <N>. Last gate result: <pass/fail>.
Do not start any work outside phase <N> and do not touch files listed as frozen.
First reply: (a) restate the phase goal in 2 lines, (b) list the files you will create or
change, (c) list what you will NOT touch, (d) the exact command that will prove it works.
Then wait for my go-ahead.
```

At the end of every session, update `BUILD-TRACKER.md`.

---

## 9. Data Migration Rule

The three demo tenants in `db.json` are the regression fixture:
- `scripts/migrate-json.js` imports a JSON store into Postgres, deterministic IDs preserved.
- `scripts/parity.js` runs the same 12-step journey against both stores and diffs the
  serialized state.
- The JSON store stays in the repo permanently as the zero-dependency demo path.

---

## 10. Production Watch — Five Alarms

1. **Bot silence**: zero inbound messages for 3 daylight hours on a tenant that averages >20/day.
2. **WhatsApp status != connected for 15 minutes**: owner banner + alert.
3. **Queue stall**: waiting patients > 0 and no called event for 45 minutes during open hours.
4. **Error rate**: >1% 5xx over 5 minutes.
5. **Cost anomaly**: message spend >2× the trailing 7-day average.

---

## 11. Change Control

New ideas go into `BUILD-TRACKER.md` → Parked. Re-enters only if:
1. Current phase gate is green.
2. Requested by a paying tenant or pilot.
3. Fits the current phase files.
4. Ships in ≤1 day.

---

## 12. Handover — Exit Criteria

You are done with the build when all seven are true:
1. `npm run accept` passes on a fresh database, unattended.
2. `npm run gate:7` is green and documented in `BUILD-TRACKER.md`.
3. You can deploy a change to production by following `DEPLOY.md` without asking anyone.
4. You can restore from a backup into a scratch environment and see yesterday's queue.
5. The five alarms have fired at least once in staging.
6. One real clinic has run a full day on it without calling you.
7. A second person could take over from `AGENTS.md` + `BUILD-TRACKER.md` alone.
