# BAARI — Strategy Pack v1.0
*Zero-App WhatsApp Appointment · Live OPD Token Queue · Lab Prescription Quoter · Waiting-Room TV*

**Built:** 29 Oct 2026 · **Launch city:** Ludhiana · **WhatsApp lane:** Baileys QR primary, Meta Cloud API failover

---

## Read in this order

| File | What's inside | Read time |
|---|---|---|
| **[01-brand-book.md](01-brand-book.md)** | 10-name shortlist with scoring → **final name: `baari`**, tagline, domains, colour/type/logo system, positioning, the "never say these words" list | 12 min |
| **[02-onboarding-and-ux-spec.md](02-onboarding-and-ux-spec.md)** | 8-step onboarding (target 6 min), the **60-Second Trainer** for compounders, screen-by-screen spec for `/desk` `/cabin` `/tv` `/lab` `/app` `/b/:slug`, queue-engine behaviour, edge cases | 18 min |
| **[03-pricing-and-sales-playbook.md](03-pricing-and-sales-playbook.md)** | Full price sheet (₹7.5k–₹49.9k setup + AMC), unit economics, Ludhiana locality-by-weekday plan, the 12-second opening, the 4-minute demo, 10 objections in Hinglish, 90-day plan, follow-up templates | 20 min |
| **[04-whatsapp-bot-spec.md](04-whatsapp-bot-spec.md)** | Intent taxonomy, exact conversation copy (Hindi/Hinglish/Punjabi), 2-ahead alert, review shield, lab vision→quote→GPS→report flows, Gemini prompt skeleton, anti-ban discipline | 15 min |
| **[05-build-plan.md](05-build-plan.md)** | Architecture, Supabase schema + RLS rules, full API surface, queue-engine sketch, Gemini call sites, TV implementation, **the copy-paste Google Antigravity prompt**, risk table | 18 min |

### Round 2 — answered follow-ups (read these after the five above)

| File | What's inside | Read time |
|---|---|---|
| **[06-answers-feature-matrix.md](06-answers-feature-matrix.md)** | Yes/no answer to all 13 of your questions · ⚠️ **the review-gating policy risk** · ⚠️ promotion/ban rules · repositioning to WhatsApp-only and what it costs you · revised build order | 10 min |
| **[07-lead-crm-revenue-and-followups.md](07-lead-crm-revenue-and-followups.md)** | Lead CRM schema + `/leads` daily screen · 6 revenue metrics (pipeline → recovered) · the auto-sent monthly report · follow-up sequences with ban-safe caps · no-show recovery · **knowledge base** from website/GBP/PDF/Instagram + anti-hallucination design · review de-dup ledger | 18 min |
| **[08-scheduling-and-eta-engine.md](08-scheduling-and-eta-engine.md)** | **3 doctors × 3 patients worked example** · per-provider queues & prefixed tokens · one doctor overruns 28 min → only their queue moves · ETA function + self-learning EWMA · committed slot vs rolling ETA · "ghar se 9:50 niklein" · 10 test cases | 12 min |
| **[09-whatsapp-only-packaging-and-client-requirements.md](09-whatsapp-only-packaging-and-client-requirements.md)** | WhatsApp-only repackaging · revised pricing (₹2,999–₹9,999 activation) · **the 12-question Setup Chat that onboards over WhatsApp** · 4-card staff training · **the exact client requirement checklist** · 45-min per-client delivery model | 12 min |
| **[10-review-link-and-pricing-structure.md](10-review-link-and-pricing-structure.md)** | **Review link needs no API** — what the API is actually for, where the link comes from in 30 seconds, India gotchas · **activation-fee + monthly structure**, why pure one-time and pure monthly both fail, collection mechanics, objection scripts | 10 min |

---

## The three decisions this pack makes for you

1. **Name: `baari`** — the word every patient already says ("meri baari kab aayegi?"). Teal + amber, Hinglish voice, never say "SaaS" to a doctor. Buy `baari.clinic` + `baari.co.in` first.
2. **UX law: 4 buttons, 60 seconds.** Receptionist sees only `✅ Call Next · ➕ Add Walk-in · 🚨 Emergency · ⏸ +15m`. Doctor sees one button: `Done`. TV needs no login. Owner onboarding is a WhatsApp-style chat, not a form.
3. **Sale: ₹1,500 refundable 48-hour pilot → ₹14,999 setup + ₹1,999/mo (Growth).** Demo on *their* TV, with *their* clinic name, using *their* voice note — in 4 minutes. Never discount setup; give months/screens/modules instead.

## Numbers to hold yourself to
- 300 names → 160 doors → 30 demos → 12 pilots → **8 paid, ~10 with referrals, per 45 days per rep**
- 25 tenants by day 90 ≈ **₹3.5L setup collected + ₹45–55k MRR**
- Gross margin ~90% (Baileys lane = ₹0 per message; that's why unlimited alerts fit in ₹1,999)
- **Time-to-first-token under 24h** is the one metric that predicts churn

## Deliberate choices you may want to argue with
- **`baari` next to a ₹50k hardware board, not next to Practo.** Different budget line, different buyer, no commission fight.
- **Hidden public pricing.** Website shows only the ₹1,500 pilot; prices are quoted in person.
- **Baileys default.** Free messages let you include unlimited queue alerts at ₹1,999; Meta costs (₹0.115 utility / ₹0.8631 marketing) are passed through as an add-on, never absorbed.
- **The receptionist is the champion, not the problem.** Every line of copy protects her dignity; lose her and you lose the account.
- **No clinical AI.** The bot quotes prices and times; it never diagnoses. That wall is a product feature and a legal shield.

---

## Next step
Say the word and I'll generate the **v0 runnable codebase** described in `05-build-plan.md §9` — Express API + Supabase migrations + seed + `/desk`, `/cabin`, `/tv/:slug`, `/b/:slug` UIs + mock WhatsApp/AI lanes, running here so you can click through the queue end-to-end.

**Round 2 files (06–09) supersede parts of 02 and 03:** the TV is now an optional self-serve add-on (not an install), activation fees drop to ₹2,999–₹9,999, and the product now includes lead CRM + revenue reporting + knowledge-base answering + follow-up sequences.
