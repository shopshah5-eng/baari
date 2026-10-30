# BAARI — Onboarding & UX Specification
**Goal:** a non-technical compounder or salon receptionist must operate the core loop in **60 seconds**, and a clinic owner must be **live on WhatsApp in under 7 minutes** from first login.

---

## 1. The Compounder Rules (non-negotiable UX laws)

These eight rules are the design system. Every screen must pass all eight.

| # | Rule | Why |
|---|---|---|
| 1 | **Max 4 primary buttons per screen.** | The receptionist is standing, interrupted, and talking to a patient at the same time. |
| 2 | **No settings before the first patient.** | Configuration is a second-session activity. Nothing may block go-live. |
| 3 | **One tap = one outcome.** No confirmation dialogs, no forms > 3 fields. | A dialog is a decision. Decisions stall. |
| 4 | **Every action shows a Hinglish human confirmation + 60-second Undo.** | Builds trust faster than any training video. |
| 5 | **Zero empty states.** Pre-fill everything from city/mode templates. | Doctors will not type a 40-item service catalogue. |
| 6 | **Big type.** Min 18px body, 28px numbers, 56px tap targets. Must work on a ₹8,000 Android tablet at arm's length. | Most clinics will run this on a cheap tablet or the owner's phone. |
| 7 | **Never block on network.** Optimistic UI + offline action queue, auto-retry. | Clinic wifi dies daily. |
| 8 | **The TV must be the loudest thing in the room.** Token = 14% of screen height. | It is the proof the product works, in front of every waiting patient. |

**Colour semantics (used identically everywhere):** Teal = normal · **Amber = token / "now serving"** · Red = emergency or no-show · WhatsApp Green = "this will send a WhatsApp".

---

## 2. Roles & what each one sees

| Role | Device | Sees | Can do |
|---|---|---|---|
| **Owner / Doctor** | Phone (PWA) + Desktop | `/app` — today's numbers, revenue, reviews, recalls | Everything |
| **Reception / Compounder** | Tablet at desk, or phone | `/desk` — **only** the queue + 4 buttons | Queue ops, no settings, no money |
| **Doctor / Stylist** | Own phone | `/cabin` — my line only | Call next, hold, done |
| **TV** | Clinic's Android TV | `/tv/:orgSlug` (read-only, no login, 6-digit pairing code) | Nothing. Zero auth surface. |
| **Lab technician** | Phone | `/lab` — prescription inbox, collection slots | Quote, assign, upload report |
| **Patient** | WhatsApp | Bot + `/b/:orgSlug` web booking link | Book, join, reschedule |

**Security note:** `/desk` and `/cabin` are PIN-gated (4-digit, set by owner), session lasts 12h. The receptionist never sees patient history beyond today, never sees prices, never sees revenue. This prevents staff churn from becoming data loss, and it is a *selling point* ("aapki revenue info reception wali didi ko nahi dikhegi").

---

## 3. Owner onboarding — 8 steps, target 6 min 40 s

Progress bar is a **WhatsApp-style chat**, not a wizard-with-fields. Every step says what it *buys* them.

### Step 0 — "Start" (15 s)
Screen: one button. `Continue with Google` (primary) · `Mobile number se` (secondary, OTP).
No email/password form, no "create account" language.
> **Copy:** `Baari me aapka swagat hai 🙏` / `Google se 10 second me shuru karein.` / *No credit card. No app download.*

### Step 1 — Mode switcher (10 s) ⭐ the most important screen
Three giant cards, one tap, **no drop-down**:
```
┌──────────────────┬──────────────────┬──────────────────┐
│       🩺         │       🧪         │       ✂️         │
│   OPD Clinic /   │  Diagnostic Lab  │   Salon / Spa /  │
│     Hospital     │                  │  Aesthetic Studio│
│  Doctor · Patient│  Test · Home     │  Stylist · Client│
│       · Token    │  Collection      │      · Slot      │
└──────────────────┴──────────────────┴──────────────────┘
```
> **Copy:** `Aapka setup kaunsa hai?` · `Isse sirf shabd badalte hain — Doctor/Stylist, Patient/Client. Baad me badal sakte hain.`

**The label dictionary this tap controls (ship it as one config object):**

| Concept | 🩺 Clinic | 🧪 Lab | ✂️ Salon |
|---|---|---|---|
| Provider | Doctor | Phlebotomist / Technician | Stylist / Therapist |
| Customer | Patient | Patient / Customer | Client |
| Unit | Token | Sample / Booking | Slot |
| Room | Cabin | Collection / Centre | Chair / Station |
| Visit reason | Symptom / Reason | Test / Prescription | Service |
| Money | Consultation fee | Test price | Service price |
| Follow-up | Next visit | Report delivery | Recurring appointment |

### Step 2 — Business basics (60 s)
Fields: **Clinic name** (auto-suggested from Google profile if available) · **Area/Locality** (type-ahead on Ludhiana localities) · **Phone** (pre-filled from Google) · **Google Maps link** (used later for the review shield).
Pre-filled and editable: open days, opening/closing time, lunch break, "Sunday closed" toggle.
> **Copy:** `Sirf 3 cheezein. Baaki hum bhar denge.`

### Step 3 — Team (90 s) ⭐
Card-per-person, not a table. `+ Add` opens 4 fields: name, role, avg minutes/patient (pre-set: 8 / 10 / 15 / 20 chips), days off.
> **Copy (hero microcopy):** `Dr. Sharma — 1 patient kitne minute? [8] [10] [15] [20]` · `Isse hi aapka wait-time sahi calculate hoga.`
Prefilled examples appear as ghost rows: `Dr. Sharma (10 min)`, `Dr. Kaur (15 min)`.
**One-tap skip:** `Abhi 1 doctor se shuru, baad me add karenge` → creates a default "Doctor 1".

### Step 4 — WhatsApp connect (90 s) ⭐ the magic moment
**Default lane: Baileys QR (per-tenant isolated session).** Screen shows a QR with a live countdown and a 3-panel "what happens" strip.
```
1. WhatsApp kholo        2. Linked Devices        3. QR scan karo
   (clinic ke number wale phone par)
```
States: `QR bana raha hai…` → `Scan karein (2:00 me expire hoga)` → `Connected ✓ — Dr Sharma Clinic` → **auto-sends a test voice note + text to the owner's personal number**.

> **Copy:** `Clinic ka WhatsApp aapke phone me hi rahega. Hum sirf messages bhejte hain — aapka chat, aapke paas.` (This line kills the #1 objection on the spot.)

Hidden behind `Advanced ▾` (never shown in the default flow): *Official Meta Cloud API lane* — for labs/hospitals or anyone who insists, with a 6-field token wizard and the note `+setup, per-message charges apply`. **Both lanes can be connected simultaneously** — see failover spec (§5 of the build plan).

Hard guardrails shown as friendly warnings, not errors:
- `⚠️ Yeh number already kisi aur clinic se juda hai` → require owner OTP to move.
- `⚠️ Business app me pehle se WhatsApp Business app chal raha hai?` → guide to migrate to a number not on WhatsApp Business app (or use a fresh SIM, ₹200).

### Step 5 — Catalogue (60 s)
Mode-specific **pre-filled catalogue**; owner taps to include/exclude, edits price only if they want.
- 🩺 Dental: Consultation ₹300 · Scaling ₹1,200 · RCT ₹4,500 · Extraction ₹800 · Braces ₹35,000
- 🩺 General/Skin/Peds: Consultation ₹500 · Follow-up ₹200 · Dressing ₹300 · Vaccination ₹1,200
- 🧪 Lab: CBC ₹250 · LFT ₹600 · KFT ₹600 · HbA1c ₹450 · TSH ₹250 · Lipid ₹500 · Vitamin D ₹1,200 · Home collection ₹150
- ✂️ Salon: Haircut ₹300 · Beard ₹150 · Hair Colour ₹1,500 · Facial ₹1,200 · Waxing ₹800 · Bridal ₹8,000
> **Copy:** `Aapke city ke hisaab se price bhar diye hain. Ek tap me badal dein.`
(Salon-specific: `Instagram wale customers ke liye ek booking link bhi milta hai` → shows `/b/:slug`.)

### Step 6 — TV display (60 s)
Three ways, in this order:
1. `TV pe Chrome kholo aur yeh link daalo` → `baari.clinic/tv/dr-sharma-clinic` (short, typeable)
2. Big **6-digit pairing code** shown (`TV pe code daal do — 482913`) — protects against URL typo hell
3. Copy button / WhatsApp-to-self

Then **`🔊 Test announcement chalao`** → the TV speaks *"Token Number 18, kripya Cabin 1 mein aayein"* out loud.
> **Copy:** `Aapke clinic ki TV hi ab token board hai. ₹50,000 ka kharcha bacha.`

### Step 7 — Payments & plan (60 s)
Two choices only: **48-hour VIP Pilot ₹1,500** (default, refundable/adjustable) or **Full setup (₹7,500–₹25,000)**.
Pay by **Direct UPI QR on screen** (works for every Indian, zero MDR) or Razorpay (card/netbanking/EMI).
> **Copy:** `2 din chala kar dekhiye. Pasand na aaye to paisa wapas.`

### Step 8 — Go live (30 s) ✅
One screen, three artifacts generated automatically:
1. **`Aapka clinic LIVE hai`** + a WhatsApp bubble preview of exactly what their patients will receive.
2. **Download QR standee PDF** (A5, their clinic name, their QR, Hindi copy) — print-ready.
3. **`Khud try karein`** — `Apne personal WhatsApp se is number par "hello" bhejein` → the owner experiences the patient journey as a patient. **This single step is what converts pilots to paid.**

Then: the **First-Day Checklist** (5 items, checkable), and the **60-Second Trainer** for the receptionist (below).

### Onboarding instrumentation (build this from day 1)
Track `signup → mode → basics → team → WA_connected → tv_paired → first_token_issued`. **The only metric that matters is time-to-first-token.** If a tenant doesn't issue a token within 24h of signup, they churn. Trigger an automated WhatsApp nudge to the owner at +4h and +20h.

---

## 4. The 60-Second Trainer (the receptionist card)

Presented as **4 full-screen cards**, one icon each, then a 3-tap test. Perfect score → `Baari Pro ✓` badge on her profile (gamification works surprisingly well on desk staff; a small ₹500 Diwali bonus from the owner for the badge works better).

| Card | Big icon | Hindi | English |
|---|---|---|---|
| 1 | ➕ | **Naya patient aaya? "Add Walk-in" dabao.** Token khud ban jayega, WhatsApp par chala jayega. | Patient arrives → tap **Add Walk-in**. |
| 2 | ✅ | **Baari aayi? "Call Next" dabao.** TV pe naam aayega, awaaz bhi aayegi. | Turn arrives → tap **Call Next**. |
| 3 | ⏸ | **Doctor late? "+15 min" dabao.** Sab waiting patients ko khud message chala jayega. | Doctor delayed → tap **+15 min**. |
| 4 | 🚨 | **Emergency? "Emergency" dabao.** Sabko message chala jayega ki ek emergency case aaya hai. | Emergency → tap **Emergency**. |

**Test:** 3 taps — add a walk-in, call next, hit +15. 3/3 → badge. 2/3 → replay card. *Passing takes 40 seconds.*

**The card that gets printed and taped to the desk:**
```
┌──────────────────────────────────────────┐
│  BAARI — 4 BUTTONS, BAS                     │
│                                           │
│  ➕ ADD WALK-IN   Patient aaya             │
│  ✅ CALL NEXT     Baari aayi               │
│  ⏸  +15 MIN       Doctor late              │
│  🚨 EMERGENCY     Sabse pehle              │
│                                           │
│  Kuch bhi galat?  60 second UNDO          │
│  Help: WhatsApp "help" @ 98xxxxxxx        │
└──────────────────────────────────────────┘
```

---

## 5. Screen-by-screen spec

### 5.1 Reception Console — `/desk` (the money screen)

**Layout (tablet landscape priority; identical on phone, stacked):**

```
┌───────────────────────────────────────────────────────────────┐
│ Dr Sharma Dental · Model Town        🟢 WA · 4:12 PM  [🔒]     │  ← 56px
├───────────────────────────────────────────────────────────────┤
│  NOW SERVING                                          WAITING  │
│  ██ TOKEN 12 ██   Dr. Sharma · Cabin 1                  09 ──  │
│  est. wait ~22 min                                     ~22m    │
├───────────────────────────────────────────────────────────────┤
│  #13  Gurpreet Singh   10:40  "tooth pain"     ✅ 📞 ⏭          │
│  #14  Ritu Sharma      10:50  "cleaning"       ✅ 📞 ⏭          │
│  #15  Harpreet Kaur    11:00  "braces check"   ✅ 📞 ⏭          │
│  #16  (walk-in)        —      —                ⏳               │
├───────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ ✅ CALL  │ │ ➕ ADD   │ │ 🚨 EMERG │ │ ⏸ +15m   │          │  ← fixed, 88px
│  │   NEXT   │ │ WALK-IN  │ │  QUEUE   │ │  DELAY   │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
└───────────────────────────────────────────────────────────────┘
```

**The four actions, precisely:**
1. **`✅ CALL NEXT`** (primary, largest, teal) — marks the next token `CALLED`, fires TV announcement, sends the patient a WhatsApp: *"🎫 Aapki baari aa gayi! Cabin 1 mein aayein."* **Idempotent within 5 s** (double-tap = no double call).
2. **`➕ ADD WALK-IN`** — bottom sheet, **3 fields max**: name (optional — defaults to "Walk-in"), phone (optional — needed for WhatsApp alerts), doctor (defaulted to first). **Two taps to a token.** If phone is empty → token is TV-only + a printed slip (`🖨 Print` / `WhatsApp` / `SMS`).
3. **`🚨 EMERGENCY JUMP`** — long-press (2s) to prevent accidents → inserts at position 1 → auto-broadcasts to everyone waiting: *"Ek emergency case aaya hai, aapka number ~10 min late chalega. Dhanyavaad 🙏"*. Red banner on TV for 60s.
4. **`⏸ DOCTOR DELAYED`** — opens `+15m / +30m / Doctor not available` chips → broadcasts to today's remaining tokens.

**Row actions** (swipe-left on phone, tap menu on tablet): `Arrived ✓` · `Call now` · `Skip (no-show)` · `Move to doctor 2` · `Cancel` · `Read prescription`.

**Ticker strip** (thin, top): `Aaj: 34 patients · 3 no-show · Avg wait 21m · Reviews 4.8★` — the owner sees this every time she walks past. **This is your renewal proof.**

**Offline behaviour:** all 4 buttons enqueue locally with a grey `⏳` badge and flush on reconnect. The TV, being on the same LAN-backed browser, keeps working from cached state via a local BroadcastChannel + service worker.

### 5.2 Doctor / Stylist view — `/cabin` (phone-first PWA)
One column, one giant button.
```
┌─────────────────────────────┐
│ Dr. Sharma · Cabin 1    4:12│
│                             │
│   NOW: TOKEN 12             │
│   Gurpreet S. · tooth pain  │
│   waited 14 min             │
│                             │
│  ┌───────────────────────┐  │
│  │   ✅ DONE → NEXT      │  │  ← 96px tall, full width
│  └───────────────────────┘  │
│  [ ⏸ HOLD 5m ] [ ➡ CABIN 2 ]│
│                             │
│  Agla: #13 Gurpreet · #14 Ritu│
└─────────────────────────────┘
```
> **Copy:** `Doctor ko sirf ek button dabana hai — "Done". Baaki Baari khud karega.`

### 5.3 Waiting-room TV — `/tv/:orgSlug` (the ₹50,000 killer)

**Requirements:** any Android TV / Fire Stick / old tablet browser, no login, no install, self-healing after power cuts, readable from 6 m.

```
┌──────────────────────────────────────────────────────────────┐
│ [CLINIC LOGO]  Dr Sharma Dental            🕓 4:12 PM   🔊   │
├───────────────────────────────────┬──────────────────────────┤
│                                   │  NEXT / AAGE              │
│         NOW SERVING               │  ┌─────┐  ┌─────┐        │
│         AB CHAL RAHA              │  │ 13  │  │ 14  │        │
│                                   │  │Gurp │  │Ritu │        │
│            ██ 12 ██               │  └─────┘  └─────┘        │
│                                   │  ┌─────┐  ┌─────┐        │
│      CABIN 1 · Dr. Sharma         │  │ 15  │  │ 16  │        │
│                                   │  │Harp │  │——   │        │
│      ⏱ Aapka number aane wala hai  │  └─────┘  └─────┘        │
├───────────────────────────────────┴──────────────────────────┤
│ 🔊 "टोकन नंबर १२, कृपया कैबिन १ में आइए"  ·  ਕਿਰਪਾ ਕਰਕੇ …      │  ← ticker
└──────────────────────────────────────────────────────────────┘
```
- **Auto-announce** on every `CALLED` event: `"Token Number 12, kripya Cabin 1 mein aayein"` — 2 chimes, then voice, then 2 repeats 20 s apart, then stop.
- **Language:** `हिंदी | ਪੰਜਾਬੀ | English` chips in the corner (default: Hindi + the pair the owner set). Ticker alternates languages.
- **Visual pulse** on the called token for 30 s (amber → teal), so a patient who missed the audio still sees it.
- **Idle state (no queue):** clinic logo + `Aaj ka schedule: 9:00 AM – 8:00 PM` + rotating health tip. **Never a black screen.**
- **Multi-doctor:** split-screen by cabin (2 cabins = 50/50, 3 = thirds). `?screen=2` for a second TV.
- **Resilience:** service worker + IndexedDB; if the internet drops, it replays the last known state and shows a discreet `⟳` dot. If the token state is >5 min stale, it shows the number *without* the "live" dot rather than lying.
- **Anti-abuse:** the URL is public but read-only and shows only token numbers + first name + cabin. No phone numbers, no full names, no diagnosis. (DPDP posture; also what doctors ask about in minute 3 of the demo.)

**Audio implementation (important, cheap):**
1. Pre-generate **MP3 packs** at build time: numbers 1–500 × 3 languages + 8 cabin phrases → ~60 MB total on CDN/self-hosted. **Reliable, instant, zero per-play cost.**
2. Fallback to the browser's `SpeechSynthesis` (`hi-IN` / `pa-IN`) if a number > 500 or offline pack missing.
3. Never call Gemini/Google TTS at announcement time — a 900 ms latency on a token announcement feels broken and costs money per play.

### 5.4 Lab desk — `/lab`
```
┌───────────────────────────────────────────────────────────────┐
│ Prescription Inbox (7 new)                    🟢 WA · 4:12 PM  │
├───────────────────────────────────────────────────────────────┤
│ [img] Ritu Sharma · 98xxxx · 2 min ago       AI: 92% ✓        │
│       CBC, LFT, TSH          ₹1,100 · Fasting 10-12 hrs       │
│       📍 Sector 32, Ludhiana (pin)   Home collection: 7–9 AM  │
│       [ ✅ Send Quote ]  [ ✏️ Edit Tests ]  [ 📞 Call ]        │
├───────────────────────────────────────────────────────────────┤
│ [img] Gurpreet K · 98xxxx · 14 min ago      AI: 61% ⚠️        │
│       "Lipid profile + Vit D" (handwriting unclear)           │
│       [ ✅ Send Quote ]  [ ✏️ Edit Tests ]                    │
└───────────────────────────────────────────────────────────────┘
```
- **Confidence routing:** ≥85% → auto-quote within 30 s (staff can override); 60–85% → staff confirms with one tap; <60% → routed to a human with the cropped region highlighted.
- **Money path:** quote → `[Book Collection]` → phlebotomist assignment → morning route → report PDF upload → auto-send with a *"Report taiyar hai"* message + a 5★ review ask 2 h later.
- **Never auto-send a report without staff confirmation for the first 30 days of a tenant.** (Regulatory + trust.)

### 5.5 Owner home — `/app`
Five numbers, no charts nobody reads:
`Aaj ke patients` · `Avg wait` · `No-show % (recovered ₹)` · `Google reviews is month (★)` · `Recall due this week`
Plus: `Aapka TV chal raha hai? 🟢` (last heartbeat), `WhatsApp 🟢`, and **one** upsell card, never two.

### 5.6 Public booking page — `/b/:orgSlug` (the Instagram link)
Mobile-first, one screen: clinic name, timings, `Book Appointment` / `Join Today's Line`, service chips, doctor chips, **and a `WhatsApp par baat karein` button** that opens the bot with a pre-filled message. This page is what a salon puts in its Instagram bio — it is a *growth channel*, price it into the Pro tier.

---

## 6. Queue engine (behavioural rules the UI must honour)

**States:** `BOOKED → ARRIVED → CALLED → IN_CONSULT → DONE` · branches: `NO_SHOW`, `SKIPPED`, `HOLD`, `CANCELLED`.

**Wait estimation:** `EWMA(last 10 consultations for that doctor, that time-of-day bucket)` → fallback to the doctor's configured avg → fallback to 10 min. Recompute on every state change. Round to 5 minutes; **never show "17 minutes"** — show `~15–20 min`.

**The 2-ahead alert (the flagship):**
- Trigger when `position_ahead <= 2` **and** the patient hasn't arrived (checked-in flag false) **and** the alert hasn't fired for this token today.
- Message: *"🔔 Ritu ji, aapki baari ~15 min mein! Ghar se nikal aaeyein — aap se pehle 2 log hain. Token #14 · Dr. Sharma · Cabin 1"*
- Also fire a **3-ahead** soft ping if their travel time (optional, GPS-permitted) > remaining wait.
- **Rate-limit: max 1 queue-alert per patient per hour.** Patients mute/block; that kills the WhatsApp lane.

**Emergency:** insert at index 0, shift all downstream ETAs by `avg_consult`, broadcast a single consolidated delay message (not one per patient).

**Doctor delayed:** shift ETAs, broadcast once per affected batch, and auto-offer `[Reschedule]` to anyone whose new ETA crosses their stated "must leave by" time.

**No-show:** at `CALLED` with 2 minutes of non-arrival, mark `SKIPPED` (not `NO_SHOW` — softer word, same effect), and send *"Aapka number aage badha diya gaya hai. Wapas aayein to 1 tap me line mein lag jayenge."*

---

## 7. Failure & edge cases (design these before building)

| Situation | Behaviour |
|---|---|
| WhatsApp session drops (Baileys logout) | Red banner on `/desk` + owner WhatsApp + email: `WhatsApp reconnect karein (1 min)`. TV + queue keep working. |
| Patient phone has no WhatsApp | Auto-fallback to **SMS** (if DLT-approved sender) → else a **printed token slip** + TV only. Never fail silently. |
| Two receptionists tap "Call Next" at once | Server-side lock; second tap returns the *same* token. |
| Doctor doesn't press "Done" | Auto-close after `avg_consult × 2`, log it, and gently prompt the doctor once. |
| Power cut / internet down | `/desk` offline queue; `/tv` cached state; both recover with a `⟳` indicator, never a spinner. |
| Patient has no smartphone | Receptionist prints slip; TV announces; 2-ahead alert becomes a **counter beep**. |
| Clinic wants the whole thing in Punjabi | Per-tenant `locale` + per-screen language chips; voice packs already cover pa-IN. |
| Tenant asks for a second TV | `/tv/:slug?screen=2` — no extra setup, monetise as an add-on. |
| Owner wants to cancel | Export all data (CSV + PDF) in one tap, revoke WhatsApp session instantly. **Say this in the sales pitch** — it disarms the biggest objection. |
