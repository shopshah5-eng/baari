# BAARI — The Platform Explained
*What it is, who pays for it, and exactly what happens behind every message.*

---

## 1. The idea in one paragraph

Indian clinics, labs and salons run their front desk on a phone, a paper register and hope. A patient walks in, gets a handwritten token, sits in a crowded waiting room, and calls reception every ten minutes to ask **"meri baari kab aayegi?"** — *when is my turn?*

**Baari is the answer to that sentence.** A clinic connects its own WhatsApp number, and from that moment every patient enquiry is answered, booked, queued, timed, reminded, followed up, and asked for a review — automatically, inside WhatsApp, with no app to download, no hardware to buy, and no software for the doctor to learn.

The product is not "clinic software". It is **the front desk, automated** — the twenty metres between the clinic door and the doctor's cabin.

---

## 2. Why this is possible now (and wasn't three years ago)

Four things converged:

1. **WhatsApp penetration.** Every patient already has it. Nobody in India needs to be taught to use WhatsApp, including a 65-year-old patient and a compounder with a ₹8,000 phone.
2. **WhatsApp Web automation.** A clinic's own number can be driven programmatically, so the patient talks to *Dr Sharma Dental*, not to some third-party app. Trust stays with the clinic, and the cost per message is zero.
3. **Cheap, capable AI.** Gemini-class models read a handwritten prescription photo, understand a Punjabi voice note, and classify intent — for a few paise per message. In 2021 this was a ₹5-lakh ML project; now it's an API call.
4. **The incumbents went the wrong way.** Practo and MocDoc built marketplaces and full practice-management suites: commissions, competitor ads, doctor training, high price. Nobody built the small, boring, high-pain thing — the queue.

---

## 3. Who it serves, and the exact pain

| Segment | The daily pain | What Baari removes |
|---|---|---|
| **OPD clinics** (dental, skin, paediatric, ortho, eye, polyclinics) | Crowded waiting room; reception answers "number kab aayega" 40× a day; ₹30k–₹80k LED token boards; doctors hate Practo's commission and ads | Live token on the patient's phone, per-doctor timing, WhatsApp pings before their turn, TV display on the TV they already own |
| **Diagnostic / pathology labs** | Patients send blurry prescription photos asking "kitna kharcha aayega, ghar kab aaoge?"; staff manually send PDF reports all day | Vision AI reads the photo → instant quote + fasting rules → GPS home-collection booking → auto report delivery |
| **Salons / spas / aesthetic studios** | Missed evening and Instagram DM bookings, 30% no-shows, no repeat reminders, no review follow-up | WhatsApp booking, slot + stylist timing, reminders, no-show recovery, recall ("35 din ho gaye"), review engine |

All three run on **one platform with three label sets** — Doctor/Patient/Token becomes Test/Customer/Sample becomes Stylist/Client/Slot. Same code, different words. That matters commercially: you build once and sell three times.

---

## 4. The core mechanic: the patient is never shown a queue they can't understand

This is the single most important design decision, and everything else follows from it.

**There is no global queue.** There are *N independent per-provider queues* running in parallel, each at its own speed. Tokens are prefixed by provider: `S-07` is Dr Sharma's 7th patient, `K-04` is Dr Kaur's 4th.

So a patient is only ever told:

> 🎫 **Token S-07** · Dr. Rajesh Sharma · Cabin 1
> Anumaanit samay: **~12:10–12:24pm**
> Aapse pehle **1 log** hain.
> Ghar se **11:45am** niklein (12 min raasta + 10 min buffer).

They are never told "token 62 is now serving". That number belongs to somebody else's doctor and means nothing to them. This is why 3 doctors × 3 patients produces three completely different timings with zero confusion — the question that usually breaks queue software.

---

## 5. A patient's journey, minute by minute — with what happens behind it

### 09:41 — Enquiry
Patient messages the clinic: *"Dr. Sharma ko aaj shaam dikhana hai, daant me bahut dard hai"* (or sends this as a **voice note** — Gemini reads audio directly, no speech-to-text step).

**Behind it:** the message lands in the gateway, is normalised (`{phone, text, type}`), and goes to the bot. Gemini classifies it as `BOOK_TODAY`, extracts the provider hint, the symptom, and the urgency. Critically, **the AI never invents a token number, a price or a time** — it only fills slots. The engine composes every number the patient sees.

### 09:41:04 — Token issued
The queue engine:
1. Finds or creates the patient record (per tenant — patient data is never shared across clinics).
2. Picks the provider: the named one, else the **earliest-available** by summing remaining durations in each provider's queue, biased towards whoever they saw last.
3. Allocates the next number *for that provider only*.
4. Computes the ETA (see §6).
5. Computes `leave_by = eta_start − travel_time − 10 min buffer`.
6. Creates or updates the **lead record** and sets its stage to `booked`, with the service price as estimated value.

Reply, in under a second on the mock lane:
> ✅ Aapki baari pakki!
> 🎫 Token S-07 · Dr. Rajesh Sharma · Cabin 1
> 🕐 ~12:10–12:24pm
> aapse pehle 1 log hain.
> 🚗 Ghar se 11:45am niklein (12 min raasta + 10 min buffer).

Then one question: *"Aapka naam aur area?"* — because a name makes every later message human ("Ritu ji, nikalne ka time hai"), and an area makes the travel estimate real. The Ludhiana locality table knows Model Town ↔ Sarabha Nagar is 12 minutes; a missed answer just defaults to 20 minutes and never blocks anything.

### 09:52 — The patient checks, without calling
*"mera number kab aayega?"* → the bot answers with their **own** position: *"Aap S-07 hain. Abhi S-06 chal raha hai. Aapki baari ~12:10 — 1 log aapse pehle."*

This one exchange is what the clinic actually pays for. It is the 40 phone calls a day, gone.

### 11:38 — The flagship alert (2 patients ahead)
When the engine recomputes and finds this patient has **2 or fewer ahead** and hasn't arrived yet, it fires once:

> 🔔 **Ritu ji, nikalne ka time hai!**
> Aapki baari ~15 min me. Aapse pehle sirf 2 log hain.
> 🎫 S-07 · Dr. Sharma · Cabin 1
> 🚗 Niklein: **11:45am**

Guardrails: once per patient per visit, never repeated within an hour, never 9pm–8am, and if their travel time is long the alert fires at 3-ahead instead of 2. If they're already first in line, the wording changes to *"Aapka number ab hai"* rather than a false "nikalne ka time".

### 12:06 — Called
Reception taps **✅ Call Next**. Three things happen at once: the token flips to `CALLED`, the TV announces *"टोकन नंबर 7, कृपया कैबिन 1 में आइए"*, and the patient gets *"Aapki baari aa gayi — Cabin 1 mein aayein."* Double-tapping is harmless: an advisory lock plus a 5-second idempotency key means the second tap returns the same token instead of calling the next patient.

### 12:19 — Done, and the system learns
The doctor taps **Done**. Baari records the actual consultation time (13 minutes against a configured 12), feeds it into an exponentially-weighted average for that doctor, and immediately recalculates everyone behind them. After five consultations the learned average replaces the doctor's self-reported guess — and `/app` shows the owner *"aapne 12 set kiya, asli 13.4 min"*. Clicks under two minutes are ignored so a mis-tap can't poison the average.

### 14:19 — Review ask
Two hours later, once:
> 🙏 Dr. Sharma Dental — aaj aane ke liye dhanyavaad! Aapka experience kaisa raha? (1 se 5)

Whatever they answer, **everyone** gets the Google review link and **everyone** is offered a private channel to tell the doctor directly. A rating of 3 or less instantly alerts the owner privately — *before* it can become a public 1-star.

That's the whole loop. Everything else in the product is a variation or an extension of it.

---

## 6. The five engines, and what's genuinely hard about each

### 6.1 Queue engine — `src/queue.js`
Per-provider ordering with priority (`emergency` = 0), state machine (`BOOKED → ARRIVED → CALLED → IN_CONSULT → DONE`, with `SKIPPED / HOLD / CANCELLED` branches), and an append-only event log for every mutation. Every desk action is **idempotent** and **undoable for 60 seconds** — because a receptionist will mis-tap.

### 6.2 ETA engine — `src/eta.js`
Three ideas doing the work:

- **Durations come from the service, not just the doctor.** A 45-minute root canal shifts the queue by 45 minutes, not by the 12-minute consultation average. This is where most "token" apps quietly lie.
- **A window, never a point.** `~12:10–12:24pm`, not `12:17`. False precision destroys trust the first time it's wrong.
- **It learns.** EWMA over real `called → done` times, per provider, per time-of-day bucket, clamped so one bizarre hour can't wreck it.

Plus two real-world corrections: a **`delay_until`** offset when the doctor steps out (the "+15 min" button), and **lunch creep** — nobody gets promised 1:55pm when the break starts at 2:00.

### 6.3 Assignment — the multi-doctor problem
New patient with no preference goes to whoever can see them soonest:

```
availability(p) = provider_free_at(p) + Σ remaining durations of p's active queue
```
That single line is why three doctors absorb nine walk-ins into three smoothly-distributed lines instead of one crushed queue. Preference always beats optimisation — if a patient insists on the slow doctor, they're told the longer wait once and then left alone.

### 6.4 Knowledge base — `src/kb.js`
Enquiries like *"scaling ka kitna hai?"*, *"aaj khula hai?"*, *"parking hai?"* are answered from documents built out of the clinic's own data: the twelve setup answers, a price list, a website crawl, the Google listing.

The design rule: **retrieval score below threshold → refuse and escalate.** And a validator rejects any answer containing a number that isn't verbatim in the retrieved source. A wrong "I don't know, let me check" costs nothing. A wrong price costs the customer and the clinic's trust, permanently.

Every escalated question that staff answers becomes a new document — the bot gets better every week for free.

### 6.5 Lead CRM + follow-ups — `src/leads.js`
Every WhatsApp thread is a lead with a stage, an estimated value (from the price list) and — the important column — a **mandatory `next_action_at`**. A lead can't exist without a next action, which is why the pipeline doesn't rot.

Six revenue numbers, deliberately distinct so the dashboard can't lie: **pipeline** (potential) · **weighted** (probability-adjusted) · **booked** · **collected** · **recovered** (attributed to a follow-up or no-show recovery — the number that renews the contract) · **leakage** (enquiries ignored >15 min + quotes with no follow-up).

Follow-up ladder: **2h → 24h → 72h → 7d**, then silence for 30 days. With hard caps — max 3 in 7 days, max 1 in 24h, never to someone who opted out, and on the free WhatsApp lane **never to someone who has been silent more than 72 hours** (that's the exact behaviour that gets numbers reported).

---

## 7. What the staff actually does

Four WhatsApp commands, from the receptionist's own phone. No app, no login, no training:

| Command | Meaning |
|---|---|
| `add` | New walk-in → token created, patient messaged |
| `next` | Call the next patient → TV + WhatsApp fire |
| `late 15` | Doctor delayed → every waiting patient gets a new time |
| `emergency` | Jump the queue → everyone gets one consolidated delay notice |

And a touch screen at `/desk` with the same four actions, live-updating over SSE, with a 60-second undo on everything. The doctor's screen has **one** button: Done.

---

## 8. What the owner sees

Five numbers and the learning, not a dashboard nobody opens:

- Aaj ke patients · Waiting · Collected ₹ · Pipeline ₹ · **Recovered ₹** · **Leakage ₹**
- **"Baari seekh rahi hai"** — configured vs actual minutes per doctor, with the delta.
- Reviews: average, count, private low-rating alerts.
- Lab: prescriptions pending, reports pending.
- A monthly report auto-sent on WhatsApp: *62 enquiries · 41 bookings · ₹58,400 revenue · ₹11,200 recovered · 7 unanswered (₹19,000 lost opportunity) · 9 new reviews · avg wait 19 min.*

That report is the renewal argument. It's built before the dashboard, on purpose.

---

## 9. How the technology is put together

```
Patient's WhatsApp ──▶ wa-gateway ──▶ bot (intent) ──▶ engines ──▶ templated reply
   (Baileys QR lane,        │           (Gemini or          │
    Meta API failover)      │            deterministic mock) ├─ queue.js    per-provider queues
                            │                               ├─ eta.js      windows + learning
                            ▼                               ├─ kb.js       grounded answers
                     messages log                           ├─ leads.js    CRM + revenue
                                                            ├─ review.js   ask-once ledger
┌──────────────┐                                            └─ lab.js      photo → quote → report
│ /desk /cabin │◀── SSE ──┐
│ /tv  /app    │          │
└──────────────┘    realtime hub
```

**Deliberate choices:**

- **The bot understands; the code decides.** AI classifies intent and extracts slots. A deterministic engine owns token numbers, prices, times and every state transition. There is no path where a language model composes a number a patient will act on.
- **Guardrails live in the sender, not in a policy document.** `wa.send()` refuses on opt-out, quiet hours, daily caps and campaign permission before anything leaves the process. Anti-ban isn't a setting, it's a code path.
- **The TV is a dumb client.** One static HTML file, no login, no PII in the payload — token number, first name, room, doctor. It survives a power cut by replaying cached state and never shows a black screen.
- **Postgres-ready isolation.** Every tenant-owned table carries `org_id` with row-level security keyed to a per-transaction claim set from the JWT — not from the URL. The production migration, policies and queue functions exist and are tested.
- **Zero-app, zero-install.** Nothing a patient or a doctor touches needs an install. That is the entire adoption strategy.

---

## 10. Why this beats what exists

| | Practo / MocDoc | Hardware token boards | **Baari** |
|---|---|---|---|
| Cost | ₹999–₹4,000/mo **+ 6–12% commission** | ₹30,000–₹80,000 one-time + AMC | ₹4,999 setup + ₹1,999/mo, **no commission** |
| Hardware | none | LED board, wiring, remote | **their existing TV** |
| Patient app | yes (nobody installs it) | — | **none — WhatsApp only** |
| Ads to your patients | competitors advertised to your own patients | — | never |
| Timing per doctor | generic | static number | **learned, per provider, live** |
| Sells to | metros, chains | anyone | Tier-1/2/3, single owner-operators |

The killer comparison in a sales conversation is not another software product — it's the **LED token board on their wall that cost ₹50,000 and does a tenth as much.**

---

## 11. How it makes money

| | Starter | **Growth** ⭐ | Pro | Hospital |
|---|---|---|---|---|
| Activation (one-time) | ₹2,999 | **₹4,999** | ₹9,999 | ₹19,999 |
| Monthly | ₹999 | **₹1,999** | ₹3,999 | ₹8,999 |
| Annual (2 months free) | ₹9,999 | **₹19,999** | ₹39,999 | ₹89,999 |

Plus add-ons: extra TV screen ₹999/₹299mo · extra WhatsApp number ₹4,999/₹799mo · lab module ₹9,999/₹1,499mo · official Meta lane ₹4,999.

**Unit economics on one Growth clinic, year one:** ₹14,998 in activation+annual, minus ~₹2,500 delivery, ~₹4,200 infrastructure, ~₹1,800 support → **≈90% gross margin**, same-day payback because there's no ad spend.

The activation fee isn't for labour — it's a **commitment device**. Free signups don't go live. The plan that converts best in the field is the annual one: *"₹24,999 poora saal, activation free"* — same money to the clinic, a year of retained revenue and cash today for you.

---

## 12. What's built, and what stands between you and revenue

**Built and running** (this workspace): per-provider queue engine with learning ETA, WhatsApp bot with grounded answering and lab vision flow, four-button desk, cabin view, TV display, lead CRM with six revenue metrics, follow-up ladder with ban-safety caps, policy-safe review engine, lab module with report PDFs, billing with UPI QR + Razorpay + GST invoices, Google OAuth + desk PIN, setup chat, operator console, DPDP export/delete, SSE realtime, production Postgres schema with RLS, print-asset generator, Docker/PM2/systemd deployment. **34 automated tests green.**

**Three things to do before the first rupee:**

1. **Scan one real WhatsApp number.** Everything else is done; pairing needs a phone to scan the QR in `/desk`. Until then the mock lane keeps the product demoable.
2. **Point it at Postgres.** The schema and RLS are written and tested; flip `DATABASE_URL` and the JSON store retires. Do this before a second server instance.
3. **Set `AUTH_REQUIRED=true`, `ADMIN_KEY`, a real `JWT_SECRET` and your `UPI_VPA`.** Demo mode is a foot-gun in production; it exists so the preview stays clickable.

Then the whole business is one loop: **walk into a clinic at 2:30pm, demo on their own TV using their own voice note in four minutes, take ₹4,999 on a UPI QR, and have them live before closing time.**

---

## 13. The honest limit

Baari is a **front-office automation layer**, not a hospital management system. It does not do patient billing/GST invoices, EMR or prescriptions, pharmacy, IPD, insurance claims, inventory or accounting.

That is a strength, not a gap: it means Baari runs *alongside* whatever software the clinic already has instead of fighting it, it keeps you out of ABDM/HIS compliance scope, and it keeps the build small enough to ship alone.

The line to use in every sales call: **"Hum aapke software ko replace nahi karte — hum unke saamne baithne wale patient ko sambhalte hain."**
