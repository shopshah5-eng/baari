# BAARI — (A) Review Link Without API · (B) Pricing Structure Decision

---

# PART A — The Google review link needs **no API at all**. Here's what the API was actually for.

## A1. You were right — I mixed up two different jobs

| Job | What it needs | Cost / approval |
|---|---|---|
| **1. Getting a patient to leave a review** | **Just the review link in a WhatsApp message** | **₹0. No API. No approval. Works on day one.** |
| **2. Knowing whether they actually left one** | Google Places API (read rating + review count + latest 5) | One lookup per clinic per week — negligible cost |
| **3. Reading the full review history + replying to reviews from our dashboard** | Google Business Profile API, with per-clinic OAuth consent | ⚠️ Real approval friction, 2–6 weeks |

**Job 1 is 100% of what your clinic is paying for. Job 3 is a nice-to-have you should not build in v1.** My earlier document made the API sound mandatory — it isn't. Job 2 is "measurement", and it's optional.

## A2. Where the link comes from (30 seconds, no code, no API)

The clinic owner already has it. Three ways, in order of reliability:

1. **The owner copies it** — Google Business Profile app → *Ask for reviews* → copy link. Usually looks like `https://g.page/r/CdXyz123/review`. **Ask for this in Setup Chat Q11.** This is the primary path.
2. **Build it from the place ID** — `https://search.google.com/local/writereview?placeid=CHIJ...`. Get the place ID once from the clinic's Google Maps URL (you can literally read it out of the URL string) — no API call needed either.
3. **Fallback** — the plain Maps listing link. Worse (patient has to hunt for the "write a review" button), so avoid it.

Store it as `orgs.settings.google_review_url`. **One text field. Zero API keys.** A chai-wala could configure this.

## A3. So what does the Places API actually buy you? (be honest, it's small)

| You get | Worth it? |
|---|---|
| "⭐ 9 naye reviews is mahine, average 4.7★" in the monthly report | **Yes** — this is the single most renewal-driving line in the report. One weekly lookup per tenant. |
| Suppressing the re-ask if a review appeared in the last 90 days | Nice, marginal |
| Letting the owner see recent reviews inside `/app` | Cosmetic (they can open Google) |

**Recommendation:** ship with **link-only (Part A1)**. Add **read-only Places lookup (Job 2)** once you have 10 tenants and the monthly report needs the review count — it's roughly 40 lines of code and one cached weekly cron. **Never build Job 3** unless a hospital specifically pays for it.

## A4. The review engine as it actually ships — no API, fully compliant

```
Token → DONE
   ↓  (2–4 h later, never 21:00–08:00)
"🙏 Dr Sharma Dental — aaj aane ke liye dhanyavaad!
 Aapka experience kaisa raha? (1 se 5)"
   ↓
ANY answer 1–5  →  Google link to everyone (compliant)   ← THE MONEY STEP
                →  "Kuch theek nahi laga? Seedha Dr. Sharma ko bataein (private)"
   ↓
≤3★ or any complaint  →  instant private alert to owner + log in feedback table
```
Your **own 1–5 rating inside WhatsApp** is what tells you whether the visit went well — and that is *your* data, needing no Google API whatsoever. The Google link is just the exit door you hand them.

**The three things that actually raise review count (no API involved):**
1. **Timing.** Within 2–4 hours, while they're still feeling looked-after. Not next day.
2. **Friction.** One tap, link opens the review box directly. Never make them search.
3. **Wording.** `"Agar achha laga"` beats `"Please give us 5 stars"` — and the second one gets reviews filtered.

## A5. India-specific gotchas with the review link (put these in your SOP)

| Gotcha | What to do |
|---|---|
| Patient isn't signed into a Google account on that phone → Google asks them to sign in → they drop off | Copy says: *"Google account se sign in hai? Bas 30 second lagega."* Expect ~35–45% completion and don't promise 100% |
| Multiple Google accounts → "choose account" screen | Nothing you can do. Accept it. |
| They leave the app to open Chrome → muscle memory lost | Keep the message as the **last** thing they see, single link, no other links competing |
| Shorteners (`bit.ly`) look spammy and get blocked | Use the real `g.page` link |
| Google filters reviews it considers solicited | Never offer a discount/points for a review. Never say "5 star dein" |
| Clinic has two listings (old + new) | Verify the place ID points at the listing with the *current* address before wiring it |
| Reviews take 24–48 h to appear (or never) | Set expectation at onboarding: *"hum bhejte hain, Google decide karta hai dikhana"* |

## A6. What you tell the clinic (script)
> "Review ka link hum har patient ko aane ke 2 ghante baad bhejte hain — seedha Google ka review box khulta hai, 30 second. Jo khush nahi hai, use hum alag se *private* option dete hain, jo seedha aapko jaata hai. Review aaya ya nahi yeh Google se hum **padh** sakte hain (mahine me ek baar), par likhna aapke patient ke haath me hai — isliye hum *kitne* aayenge iska wada nahi karte, sirf yeh wada karte hain ki **har patient se ek hi baar poochhenge.**"

---

# PART B — Pricing: one-time fee or monthly? (Neither alone. Here's the exact structure.)

## B1. The decision, in one line
> **Small activation fee + monthly subscription, with an annual option that gives 2 months free. Never a pure one-time fee. Never a free trial with no commitment.**

## B2. Why not pure one-time

| Problem | Consequence |
|---|---|
| You have **real recurring costs** — WhatsApp sessions, Gemini calls, Supabase, servers, your support time. A one-time fee means you subsidise that clinic forever | Your margin decays to negative by month 8 |
| One-time = **no incentive to keep it working**. Support burden is unlimited but revenue stopped | You'll be fixing month-1 problems in year 2 for free |
| **No recurring revenue = no company.** You cannot hire, cannot raise, cannot survive a bad month | You rebuild the business from zero every month |
| Doctors *expect* software to be monthly (they already pay Practo/MocDoc monthly) | A "lifetime" price reads as a one-off product, not a service |

## B3. Why not pure monthly with no activation

| Problem | Consequence |
|---|---|
| ₹0 to start = **zero commitment** → they never finish the Setup Chat, never connect WhatsApp | 60–80% never activate; you paid to acquire corpses |
| No skin in the game → first sign of friction, they cancel | Month-2 churn eats your acquisition cost |
| You carry sales cost with no cash upfront | Negative cash flow while you're smallest — the worst time for it |

## B4. The recommended structure (use this exact sheet)

| Segment | Activation (one-time) | Monthly | Annual option |
|---|---|---|---|
| **Solo dentist / 1-chair salon** | **₹2,999** | **₹999** | ₹9,999/yr |
| **2–4 provider clinic / busy salon** ⭐ | **₹4,999** | **₹1,999** | ₹19,999/yr |
| **Polyclinic / lab with home collection** | **₹9,999** | **₹3,999** | ₹39,999/yr |
| **Hospital (10+ doctors)** | ₹19,999 | ₹8,999 | ₹89,999/yr |
| **48-hour pilot** (adjustable into any plan) | ₹1,000 | — | — |

**The two hero offers to actually pitch (memorise these two, not the table):**

> **A. "Aaj shuru karein"** — ₹4,999 activation + **₹1,999 mahina**. Main aaj setup kar deta hoon.
>
> **B. "Saal ka ek baar"** — **₹24,999 poora saal, activation free.** *(= ₹2,083/month, you get ₹24,999 in the bank today.)*

Offer **B second, always** — and let them feel clever choosing it. It's the same money to them, but it's a year of retained revenue and cash-in-hand for you.

## B5. The three rules that make this structure work

**Rule 1 — Activation is a deliverable, not a tax.** Make it concrete every time you say it:
> "₹4,999 me: aapka WhatsApp connect, poori service list aur price, doctors aur timings, enquiry ka jawab set karna, review link, aur QR standee. Aapko sirf 12 sawaalon ke jawab dene hain. **Main karta hoon, aap nahi.**"

**Rule 2 — Monthly is a subscription to *outcomes*, not software.** Renewal language at day 30 is never "renew karein", it's:
> "Is mahine: 62 enquiry, 41 booking, ₹11,200 follow-up se recover, 9 naye Google review. ₹1,999 ka poora."

**Rule 3 — Never discount the fees. Give time, modules, or screens.**
Concession ladder in order: 1) extra month free → 2) TV display free for 3 months → 3) Lab module 30-day trial → 4) annual at 3 months free → 5) grandfather price for 12 months. **Discounting the activation kills your price in the whole city** — Ludhiana doctors all know each other.

## B6. Collection mechanics (get this right or you become a debt collector)

| What | How | Why |
|---|---|---|
| Activation | **UPI QR on your phone, at the moment of yes** | Zero MDR, instant, no follow-up |
| Monthly | **UPI Autopay mandate / Razorpay subscription** — never manual invoices | Chasing 40 clinics for ₹1,999 on the 5th of every month will consume your week |
| Annual | Razorpay link / UPI QR | Cash in hand |
| GST | 18%, show on invoice, quote ex-GST (doctors claim input credit and respect transparency) | — |
| Failed mandate | Auto-retry day 3, then day 7, then a polite WhatsApp, then pause service not data | Never delete data for non-payment — that's a reputation bomb |

**Never build:** per-patient pricing (unpredictable for them, unenforceable for you), per-message pricing (Baileys is free — charge for it and you look greedy), unlimited free tier, lifetime deals.

## B7. Pitch scripts for the two pricing objections you'll hear most

**"Monthly kyun, ek baar me le lo?"**
> "Sir, ek baar me le lein to 4 mahine baad jab WhatsApp ka number badalna ho, ya naya doctor aaye, ya Gemini ka rate badle — kaun theek karega? Software chalta rehna chahiye, isliye chhota monthly hai. Isme support, updates, server, sab hai. Aur main Ludhiana me hi hoon, phone karne pe aa jaunga."

**"Pehle free me chala ke dikhao"**
> "Free me log chala ke nahi dekhte — isliye ₹1,000 ka 48 ghante ka pilot hai, jo plan me adjust ho jaata hai. Do din me aapke paas asli data hoga. Free me main sirf ek cheez deta hoon: aaj aapke clinic ke naam se demo bana ke dikha deta hoon."

## B8. When to raise prices
- **First 15 clients: founder's price** (₹2,999 + ₹1,499). Say the words *"yeh founder's price hai, 15 clinic tak"* — it creates urgency honestly and pre-frames the increase.
- **Client 16 onward: ₹4,999 + ₹1,999.** No apology, no explanation.
- **Annually: raise both by ~15%** and grandfather existing tenants for 12 months. Grandfathering is cheap loyalty and it kills churn conversations.
- **Never raise a price mid-term.** Raise it at renewal, in writing, 30 days ahead.

## B9. The one-number summary to keep in your head
> **₹4,999 + ₹1,999/month (₹24,999/year if they prepay). Pilot ₹1,000. Never discount the fee; give months instead. UPI QR to collect, Autopay to renew.**
