# BAARI — WhatsApp-Only Packaging, Client Requirements & 10-Minute Self-Serve Setup

You said: **strictly WhatsApp automation — no TV installs, no on-site staff training.** This document re-packages the product around that, and answers: *"what do I need from the client, and can they just answer questions and go live without me?"*

---

## 1. What the product is now (say it in one line)

> **"Baari aapke clinic ka WhatsApp sambhalti hai — enquiry ka jawab, appointment, token, timing, follow-up, review. Aapko kuch install nahi karna, kuch seekhna nahi."**

**Core (always included):** enquiry answering → appointment/booking → live token & queue → ETA + arrival timing → 2-ahead alert → reminders → no-show recovery → follow-ups → review ask → status check → revenue report. All inside WhatsApp.

**Optional modules (priced separately, never mentioned in the first demo):**
- **TV Display** — self-serve link, they open it on any TV. ₹999 setup + ₹299/mo. No visit.
- **Staff Training** — replaces on-site training with a 4-card WhatsApp course + a printable desk card. **Free, included, it's a PDF** (this is not "training setup", it's an artefact).
- **Lab Module** — prescription vision, quotes, home collection, report delivery.
- **Official Meta API lane** — for clinics who want it.

This keeps your pitch clean: *WhatsApp automation*, and lets a clinic choose extras only after they trust you.

---

## 2. Revised pricing (because there's no on-site labour to charge for)

| | **STARTER** | **GROWTH** ⭐ | **PRO** |
|---|---|---|---|
| **Who** | Solo doctor, 1-chair salon, small counter | 2–4 providers, busy salon, mid lab | Polyclinic, multi-branch, lab w/ home collection |
| **One-time activation** | **₹2,999** | **₹4,999** | **₹9,999** |
| **Monthly** | **₹999** | **₹1,999** | **₹3,999** |
| Annual (2 months free) | ₹9,999 | ₹19,999 | ₹39,999 |
| Providers | 1 | 4 | Unlimited |
| Tokens / month | 500 | 2,500 | 10,000 |
| Enquiry auto-answers | 100/mo | 1,000/mo | Unlimited |
| Full lead CRM + pipeline + revenue report | — | ✅ | ✅ |
| Follow-up sequences | 1 sequence | 4 sequences | Unlimited + custom |
| Campaigns (opted-in, throttled) | — | 500/mo | 2,500/mo |
| Google review engine | ✅ | ✅ | ✅ |
| TV display | add-on | add-on | included (2 screens) |
| Lab module | — | add-on ₹1,499/mo | included |
| Support | WhatsApp, 48h | WhatsApp, 24h | WhatsApp + call, 8h |

**Why keep an activation fee at all (defend this):** not for labour — for **activation**. Free signups do not go live. ₹4,999 paid upfront correlates so strongly with "they actually configured and used it" that it is the cheapest churn insurance you have. Frame it as:
> **"Activation ₹4,999 — isme aapka WhatsApp number connect, aapki poori service list aur price, doctors aur timings — main khud set kar deta hoon. Aapko sirf 12 sawaalon ke jawab dene hain, 10 minute. Baaki main karta hoon."**

You are still selling *your time* — just 20 minutes on a call instead of a 2-hour site visit. That is a real, defensible deliverable, and it lets you serve Ludhiana, Jalandhar and Patiala the same week.

**The 48-hour pilot stays** but becomes lighter: **₹1,000** (fully adjustable), because there's no on-site install cost to recover.

---

## 3. ⭐ The Setup Chat — go live by answering 12 questions on WhatsApp

**This is the answer to "a simple platform where they upload details and it connects and asks questions without me."** Don't build a 12-field web form nobody finishes. **The bot onboards the owner over WhatsApp**, in the same Hinglish voice their patients will see.

### 3.1 Flow
```
Owner signs up (Google or phone OTP) → clicks "WhatsApp pe setup karein"
        ↓
Bot messages the OWNER's personal WhatsApp (not the clinic number):
"Namaste 🙏 Main Baari hoon. 10 minute me aapka system chalu kar dungi.
 Sirf 12 sawaal poochhungi — ek-ek karke. Bich me rukna ho to 'ruko' likh dein.
 Chalein? [ ✅ Haan ]"
        ↓
Q1 … Q12 (one question per message, with tappable options where possible)
        ↓
Bot auto-fetches: website crawl + Google place details
        ↓
Bot proposes defaults: "Aapki website se yeh mila — sahi hai?" [ ✅ Sahi ] [ ✏️ Badlo ]
        ↓
Bot issues: QR standee PDF + desk card PDF + booking link + go-live checklist
        ↓
DONE — first real patient can be handled in the same 10 minutes
```

### 3.2 The 12 questions (complete copy)

| # | Question | Input | Why |
|---|---|---|---|
| 1 | `Aapka setup kaunsa hai?` | 🩺 Clinic / 🧪 Lab / ✂️ Salon | Drives every label |
| 2 | `Clinic ka naam aur area?` | text | Identity + locality travel time |
| 3 | `Google pe aapki listing hai? Link bhejein (ya "nahi")` | URL / nahi | Ingest hours, address, rating, reviews |
| 4 | `Aapki website hai? (ya "nahi")` | URL / nahi | Services + prices + FAQ ingest |
| 5 | `Kaun kaun milta hai? Naam + ek line me kaam + ek patient ko kitna time?` | e.g. `Dr Sharma – dental – 12 min` | Providers + base ETA |
| 6 | `Kaunsa number WhatsApp par chalega? (clinic ka ya naya)` | phone | Lane setup + QR |
| 7 | `Clinic kab khuli rehti hai? Lunch? Sunday?` | chips | Schedules + no-message windows |
| 8 | `Top 5 services aur price?` | e.g. `Consult 300, Scaling 1200, RCT 4500` | Catalogue + quotes + lead value |
| 9 | `Kya WhatsApp pe enquiry ka jawab khud dena hai? (aapki info se)` | ✅ / ❌ | KB answering on/off |
| 10 | `Booking ke baad patient ko kya bhejna hai — token, time, ya dono?` | chips | Message style |
| 11 | `Google review maangna hai? Aapka Google review link kaunsa hai?` | URL / nahi | Review engine |
| 12 | `Payment: UPI QR ya Razorpay link?` | chips | Billing |

Then a **confirmation card**, not a form review:
> ✅ **Sab set! Yeh maine samjha —**
> 🦷 Dr Sharma Dental, Model Town
> 👨‍⚕️ Dr Sharma (dental, 12 min) · Dr Kaur (skin, 6 min)
> 🕘 10–2, 5–8 · Sunday band
> 💰 Consult ₹300 · Scaling ₹1,200 · RCT ₹4,500
> 📱 WhatsApp: 98xxx (QR scan baaki hai)
> 🤖 Enquiry ka jawab: haan
> ⭐ Google review: haan
>
> **Sahi hai?** `[ ✅ Chalu karein ]` `[ ✏️ Kuch badalna hai ]`

> **Nice touch that costs nothing:** if the owner is unsure about question 5 or 8, the bot says *"Koi baat nahi, main aapki website se bhar deti hoon — aap baad me badal sakte hain."* **Never let a question block go-live.** Any unanswered field falls back to a mode-preset default.

### 3.3 The 4-card WhatsApp staff training (replaces on-site training)
Sent to the clinic's staff number(s) the moment setup completes. Each card = 1 image + 1 line + 1 tap.
```
Card 1: "Naya patient? 👉 'add' likh dein is number pe. Token khud ban jayega."
Card 2: "Baari aa gayi? 👉 'next' likh dein. Patient ko WhatsApp chala jayega."
Card 3: "Doctor late? 👉 'late 15' likh dein. Sabko message chala jayega."
Card 4: "Sab kuch dekhein: baari.clinic/desk"
```
**⭐ The staff commands work over WhatsApp too** — `add`, `next`, `late 15`, `emergency`, `skip 14`, `status`. This means **no app, no dashboard, no training** for a clinic that only wants the basics. It also means the product works on the receptionist's personal phone on day one. This is the single best answer to "no staff training setup."

---

## 4. What you need FROM the client (the one-page checklist you send as a WhatsApp image)

This is the entire ask. Print it as an A5, or send it as a WhatsApp image. Anything missing → use a preset default and go live; fix later.

**Must have (blocks go-live without it):**
1. ✅ **Business name + area/locality.**
2. ✅ **One WhatsApp-capable number** for the clinic. *(Either their existing number — with the caveat that WhatsApp Web/Business App must be disconnected — or a fresh SIM, ₹200.)*
3. ✅ **Provider list:** name + what they do + roughly how many minutes per patient.
4. ✅ **Timings:** open/close, lunch, weekly off.
5. ✅ **Owner's own mobile** for setup chat + alerts.

**Should have (bot fills defaults otherwise):**
6. Top 5–10 services with prices.
7. Google Business listing link (or "no listing").
8. Website URL (or "none").
9. Google review link (from GBP → "Ask for reviews").
10. Logo image (any JPG; used on messages & booking page).

**Nice to have (ingested later, no delay):**
11. Price list PDF / brochure photo.
12. Doctor qualifications & photos.
13. Instagram handle (salons — for the service menu).
14. Cancellation / no-show policy in one line.
15. GST number (only if they want GST invoices).

> **Send this list before the call, not during it.** The #1 reason setups stall is the owner hunting for their price list while you're on the phone. Message: *"Sir, sirf 5 cheezein chahiye — naam, number, doctor list, timings, aur top 5 services ka price. 10 minute me chalu ho jayega. Baaki main website se le lunga."*

---

## 5. What "it works live and improves with time" means concretely

| Week | What the system learns | What the owner sees |
|---|---|---|
| Day 1 | Providers, services, hours from Setup Chat | `System chalu hai ✅` |
| Day 3 | Real consultation durations vs configured | `Dr. Kaur actually 8 min leti hain (aapne 6 set kiya) — ETA update kar diya` |
| Day 7 | Patient arrival lag, no-show rate by hour | `2 PM slot me 18% log nahi aate — 1 extra token allow karein?` |
| Day 14 | Which questions patients ask most | `Sabse zyada poochha gaya: "RCT kitne ka hai" (34 baar) — price WhatsApp pe pin kar dein?` |
| Day 30 | Enquiry → booking conversion by source & service; which follow-up step converts | Monthly report (§`07` §3) |
| Day 60 | Seasonal patterns (Monday rush, wedding season for salons) | `Shaadi season me bridal enquiries 3× — Alag follow-up bhejein?` |

**Design principle:** every learning message ends with a **one-tap accept**, and every automatic change is **reversible and logged**. "It improves by itself" must never mean "it changed my prices without telling me." Prices and clinical data are **never** auto-changed; only timings and ETA parameters self-tune.

---

## 6. The revised delivery model (no site visits)

```
Day 0   Cold WhatsApp/call → 4-min phone demo (screen share or a recorded 90-sec video)
Day 0   ₹1,000 pilot OR ₹4,999 activation paid via UPI QR
Day 0   Same evening: Setup Chat (12 questions, 10 min) + WhatsApp QR scan
Day 0   Live. First patient handled that evening.
Day 1   You check the dashboard, send one WhatsApp: "kal 14 token aaye, sab theek?"
Day 3   Retention message with real numbers (this is the message that saves the account)
Day 7   Upsell: TV link (free trial) or lab module
Day 30  Monthly report auto-sent; ask for referral
```
**Total time you spend per client: ~45 minutes.** That is how you get to 100 clinics instead of 25.

---

## 7. FAQ you'll get from clients (and the answers)

| Question | Answer |
|---|---|
| "Humara purana number hai, WhatsApp Business App pe hai — chalega?" | "App hata kar connect karna hoga (2 min). Ya ₹200 ka naya number le lein — main set kar dunga." |
| "Patient ko app download karna hoga?" | "Nahi. Patient ka WhatsApp hi app hai. Kuch install nahi." |
| "Staff ko kaise sikhayenge, aap aate nahi ho?" | "Staff ko kuch seekhna hi nahi. WhatsApp pe 4 command: `add`, `next`, `late 15`, `emergency`. Ek card bhej dunga jo desk pe chipka dein." |
| "Agar internet band ho jaye?" | "WhatsApp messages queue me ruk jayenge, on hone pe chale jayenge. Data safe rehta hai." |
| "Mera data kahan jata hai?" | "Aapke naam pe, alag database, encrypted. Kabhi bhi full export. DPDP compliant. Hum aapke patients ko ads nahi bhejte." |
| "Mujhe TV chahiye token dikhane ke liye" | "Zaroorat nahi — patient ke WhatsApp pe token aata hai. Chahiye to ek link bhej dunga, aapki TV pe khul jayega, ₹999. Bina aaye." |
| "Kitne din me chalu?" | "Aaj. 12 sawaal, 10 minute." |
| "Agar main band kar dun to?" | "Ek click me poora data export. WhatsApp aapke number pe hai, mera nahi. Aapka number, aapka data." |
