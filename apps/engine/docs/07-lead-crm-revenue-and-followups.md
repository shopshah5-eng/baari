# BAARI — Lead CRM, Revenue Tracking, Follow-ups, Knowledge Base & Reviews

Everything in this document is **new** relative to the first five files. Together with `08` (scheduling) it turns Baari from "a WhatsApp token bot" into "a WhatsApp front office".

---

## 1. Why this module exists (the commercial reason)

A token bot saves the receptionist time. **A lead CRM makes the clinic money.** Clinics and salons will always pay more for the second thing, and it is the only way you justify moving a tenant from ₹999 to ₹3,999.

Your real pitch upgrades from *"waiting room ka jhanjhat khatam"* to:

> **"Baari aapke har WhatsApp enquiry ka hisaab rakhti hai — kaun poochha, kya poochha, kitna paisa bana, kaun nahi aaya. Mahine ke end me aapko ek report: 62 enquiry aayi, 41 booking hui, ₹58,000 bana, aur ₹19,000 wale 14 log aise hain jinka follow-up baaki hai."**

Every clinic owner in India understands that sentence instantly, and none of them currently have it.

---

## 2. Leads: one record per phone number, per tenant

```sql
create table leads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  patient_id uuid references patients(id),          -- link once booked
  phone_e164 text not null,
  name text,
  source text not null,          -- wa_inbound | wa_qr | web | instagram | google | walkin | phone | referral | campaign
  first_message text,            -- their exact first words (gold for sales)
  intent text,                   -- book_now | enquire | price | lab_quote | recall | other
  service_interest text,         -- resolved from KB: 'RCT', 'Hair colour', 'CBC'
  stage text not null default 'enquiry',
     -- clinic : enquiry → quoted → booked → visited → treated → recalled
     -- lab    : enquiry → quoted → collection_booked → collected → reported
     -- salon  : enquiry → slot_offered → booked → attended → rebooked
  est_value numeric(10,2),       -- ₹ from the price list, per service
  probability int default 30,    -- 10 enquiry, 40 quoted, 70 slot offered, 90 booked, 100 treated
  owner_id uuid,                 -- assigned staff
  next_action_at timestamptz,    -- THE most important column in this table
  next_action text,              -- 'call back', 'send price', 'confirm slot'
  last_inbound_at timestamptz,   -- powers the 24h window + ban-safety rules
  do_not_contact boolean default false,
  lost_reason text,              -- 'too expensive' | 'went elsewhere' | 'no reply' | 'out of city'
  created_at timestamptz default now(),
  unique (org_id, phone_e164)
);

create table lead_events (        -- append-only timeline, one row per thing that happened
  id bigserial primary key,
  org_id uuid not null, lead_id uuid not null,
  type text not null,             -- in_msg|out_msg|quote|booked|visited|no_show|followup_sent|note|stage_change
  payload jsonb, actor_id uuid, created_at timestamptz default now()
);
```

**Two rules that make this actually used:**
1. **`next_action_at` is mandatory.** A lead cannot be saved without a next action and a time. This single constraint is why the pipeline doesn't rot.
2. **Stage transitions are automatic, never typed.** `booked` fires when a token is created; `visited` when the token hits `DONE`; `no_show` from `SKIPPED`. Staff never update stages by hand — they will not.

### The daily list the staff actually sees (`/leads`)
```
AAJ KA KAAM (14)
──────────────────────────────────────────────────────────
🔴 3 enquiry — 2 ghante se reply nahi   [Reply] [Call]
🟠 5 quote bheja — follow-up due today   [WA bhejein]
🟡 2 slot offer kiya — confirm karna hai
🟢 4 aaj aane wale (token booked)         [Line dekhein]
💰 ₹19,000 pipeline · ₹8,500 aaj confirm hua
```
Colour = urgency, one action per row. **No table view, no filters, no columns to configure.** A salon receptionist must be able to work this screen with one thumb.

---

## 3. Revenue tracking (what "potential revenue" should actually mean)

Four numbers, each computed differently. Don't mix them — this is where dashboards start lying.

| Metric | Formula | Why the owner cares |
|---|---|---|
| **Pipeline value** (potential) | `Σ est_value` where stage ∈ (enquiry, quoted, slot_offered) | "Kitna paisa line me hai" |
| **Weighted pipeline** | `Σ (est_value × probability/100)` | Honest forecast — use this in the monthly report, not raw pipeline |
| **Booked value** | `Σ est_value` where stage = booked | Money with a date on it |
| **Collected / treated value** | `Σ service price` for tokens that reached `DONE` | Actual revenue |
| **Recovered value** | `Σ est_value` of bookings created by a *follow-up* or *no-show recovery* message | **The number that renews the contract.** Attribute via `lead_events.payload.via = 'followup_step_2'` |
| **Leakage** | enquiries with no reply >15 min + quotes with no follow-up >48h + no-shows not recovered | What they're losing right now |

### The monthly report (auto-sent on WhatsApp, 1st of the month, 9 AM)
> 📊 **Dr Sharma Dental — October ka hisaab**
>
> 📥 Enquiry aayi: **62** (WhatsApp 48 · Walk-in 9 · Instagram 5)
> ✅ Booking hui: **41 (66%)**
> 💰 Revenue: **₹58,400**
> 🔁 Baari ne recover kiya: **₹11,200** *(14 follow-up + 6 no-show wapas)*
> ⚠️ Bina reply chhooti: **7** · Bina follow-up chhooti: **11** → **₹19,000 ka mauka**
> ⭐ Google reviews: 9 naye (4.7★ avg)
> ⏱️ Average wait: 19 min (pichhle mahine 27 min)
>
> *Sabse achha din: Saturday (18 patients). Sabse zyada enquiry: "RCT ka kitna kharcha".*
> `[ Poora report dekhein ]` `[ Team ko bhejein ]`

That report is the entire renewal argument. **Build the report before you build the dashboard.**

---

## 4. Follow-up engine (for enquiries that don't book)

### 4.1 The sequence

Configurable per mode, shipped pre-tuned. Default clinic sequence:

| Step | When | Message (Hinglish) | Stop condition |
|---|---|---|---|
| 0 | Instant | *(the actual answer — quote/slot/info)* | — |
| 1 | **+2 h** (only if no booking) | "Sir/ma'am, koi sawaal hai? Price ya time ke baare me bata dein 🙏" | any inbound reply |
| 2 | **+24 h** | "Dr. Sharma ke paas kal **11:30 AM** aur **6:15 PM** khali hai. Book kar dein?" | booked |
| 3 | **+72 h** | "Aapne daant ke dard ke liye poochha tha — abhi bhi takleef hai? Aaj hi dikha lein." | booked / explicit no |
| 4 | **+7 d** | "Koi baat nahi 🙂 jab zarurat ho, yahin message kar dein. Aapka number humare paas hai." → moves to low-frequency recall list | booked / STOP |

After step 4: **silence for 30 days.** Then one recall attempt tied to a legitimate trigger (festival, recall due, new service). Never more.

### 4.2 Ban-safety caps (build these as hard code, not settings)

```
MAX 3 follow-ups per lead per 7 days
MAX 1 message per lead per 24 hours
NEVER send if last_inbound_at is NULL                  (we only reply to people who spoke to us)
NEVER send to do_not_contact = true
NEVER send between 21:00–08:00 (queue to next morning 9:30)
Baileys lane: steps 3+ require consent.marketing = true, else QUEUE-AND-HOLD
Baileys lane: if last_inbound_at > 72h ago, downgrade to "hold" (no free-form message)
Meta lane:   use approved UTILITY template, never free-form outside 24h window
On 2 bounced/failed sends to a number → suppress, mark invalid
On any "STOP" / "mat bhejo" / "pareshan mat karo" → do_not_contact = true, forever, org-wide
```
**The 72-hour rule is the important one.** On Baileys you have no template system, so a message to someone who hasn't spoken in days is exactly what gets numbers reported. Respect it in code and you'll keep clinics live for years.

### 4.3 No-show recovery (separate, higher value)
Fires at `SKIPPED` + 20 min:
> "Aapka number #14 tha, aap nahi mile. Koi baat nahi 🙂 abhi #16 chal raha hai — wapas line me lag jayein?
> `[ 🔄 Wapas lagao ]` `[ 📅 Kal aa jaunga ]`"

Recovered no-shows are ~2× more likely to convert than cold enquiries. Track them as `recovered_value`.

---

## 5. Knowledge base: answering enquiries from *their* data

This is the module that makes the bot feel intelligent rather than scripted — and the one you must build carefully, because a hallucinated price destroys trust instantly.

### 5.1 Sources to ingest (in order of value)

| Source | Method | What you get | Effort |
|---|---|---|---|
| **Website URL** | Headless crawl (15 pages max, 2 levels) → clean text → chunks | Services, prices, doctors + qualifications, timings, address, "about", FAQ | Easy |
| **Price list / brochure PDF or photo** | Upload → Gemini Vision → structured `{service, price, duration}` | The single most valuable dataset | Easy |
| **Doctor / stylist CVs & photos** | Upload → Vision | Names, specialties, experience, languages | Easy |
| **Google Business Profile** | Places API (`place_details`) once, refreshed weekly | Name, address, hours, phone, categories, rating, **up to 5 reviews** | Easy but limited |
| **Google Business Profile (full)** | Business Profile API — **requires Google approval** | All reviews, Q&A, and ability to *post replies* | ⚠️ Approval friction, 2–6 weeks |
| **Instagram bio + highlights** | Paste handle → fetch public profile text/OG tags → Vision on screenshots | Salon service menus (often *only* published here) | Medium, brittle |
| **Owner's own words** | The Setup Chat (`09` §3) asks 12 questions | Exact prices, timings, policies — highest trust | Trivial |
| **Corrections over time** | Whenever staff answers an escalated question, save that answer to the KB | Gets smarter every week, for free | ⚡ the flywheel |

### 5.2 Grounded answering (the anti-hallucination design)

```
inbound question
   ↓
1. Retrieve top-5 chunks (pgvector + Gemini embeddings; BM25 keyword fallback for v0)
2. If max similarity < threshold  →  DO NOT ANSWER. Escalate.
3. Gemini prompt: "Answer ONLY from the CONTEXT below. If the answer is not fully
   in the context, output {escalate:true}. Never state a price, duration, doctor name
   or timing that is not verbatim in the context. Keep it under 35 words.
   Answer in the patient's language (Hindi/Hinglish/Punjabi/English)."
4. Answer passes a validator: any ₹ amount / time / number in the output must appear
   in the retrieved context, else → escalate.
5. Escalate = "Yeh jaankari mere paas nahi hai — clinic se poochh kar 2 minute me
   bataata hoon 🙏" + red card on /leads + staff reply is auto-saved to the KB.
```

**Rule: a wrong "I don't know" costs you nothing. A wrong price costs you the customer.** Tune the threshold aggressively toward escalation.

### 5.3 Honest capability notes (don't oversell these to a clinic)
- **Google Business Profile:** reading hours/address/rating/5 latest reviews works via Places API on day one. **Everything else** (full review history, replying to reviews, posting updates) needs the Business Profile API with a Google approval process tied to the *clinic's own* account — i.e. the clinic must authorise you. Plan for "request access during onboarding, works in 2–6 weeks" — not "instant".
- **Instagram scraping is fragile** and against IG's terms if automated at scale. Do it once, at onboarding, on the owner's request, from data they own — and store the result. Don't build a crawler that runs daily.
- **Prices change.** Every price in the KB shows an "updated 42 days ago" stamp on `/app`, with a one-tap "update price" flow. Stale prices are the #1 silent failure mode of this module.

### 5.4 What it answers well (set expectations with the clinic)
✅ "Scaling ka kitna hai?" · "Aaj khula hai?" · "Dr. Kaur kab aati hain?" · "Parking hai?" · "Root canal ke baad kitne din rest?" · "CBC ke liye khaali pet aana hai?" · "Bridal package me kya kya hai?"
❌ (must escalate) "Mujhe bukhar hai, konsi dawa leun?" · "Mera dard kyun ho raha hai?" · "Insurance cover karega?" · "Aapke doctor ka registration number kya hai?"

---

## 6. Review request engine (de-duplicated, policy-compliant)

### 6.1 Ask-once ledger
```sql
create table review_asks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null, patient_id uuid not null, token_id uuid,
  asked_at timestamptz default now(), channel text,
  clicked_at timestamptz, feedback_rating int,
  suppressed_reason text        -- already_asked | recent_ask | low_rating | do_not_ask | no_contact
);
```

### 6.2 The gate (evaluated in this order, all must pass)
```
1. token.state = DONE  AND  token.done_at < now() - 2h
2. NOT exists(review_asks where patient_id and token_id)          -- once per visit
3. count(review_asks where patient_id, last 180 days) < 2         -- max 2 per 6 months
4. NOT exists(feedback where patient_id and rating <= 3)          -- don't ask a known unhappy patient
5. patient.consent.wa = true AND do_not_contact = false
6. current time not in 21:00–08:00
7. NOT (review_asks where clicked_at within 90 days)              -- they engaged recently; don't nag
```
If suppressed, log the reason — you'll want the analytics ("how many asks are we suppressing and why").

### 6.3 The message (compliant version — ship this one)
> 🙏 Dr. Sharma Dental — aaj aane ke liye dhanyavaad!
> Aapka experience kaisa raha? (1 se 5 — bas number likh dein)

→ on **any** reply 1–5:
> Dhanyavaad! 🙏 Do chhoti cheezein:
> ⭐ Agar achha laga, Google pe 30 second me likh dein — clinic ko bahut farak padta hai: `<link>`
> ✍️ Kuch theek nahi laga? Seedha **Dr. Sharma** ko bataein (yeh public nahi hoga) — bas likh dein.

→ if rating ≤ 3 and they type a complaint:
> Maaf kijiye 🙏 Aapki baat **Dr. Sharma tak pahunch gayi hai.** Woh khud aapko call karenge.

**Never** withhold the Google link based on rating. (See `06` §3 for why.)

### 6.4 If they don't respond
One re-ask after **72 h**, only if the first was not clicked. Then never again for that visit. If a Business Profile API grant exists, additionally suppress patients whose name matches a review posted in the last 90 days.

### 6.5 What you can honestly promise the clinic
> "Har patient se ek baar poochhenge. Jo khush hai, uska Google link. Jo khush nahi, woh aapko **private** batayega — isliye aapko bura review aane se **pehle** pata chal jayega. Jo review already de chuka hai use dobara nahi pareshan karenge."
