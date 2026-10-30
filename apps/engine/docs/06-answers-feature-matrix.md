# BAARI — Direct Answers: What It Does, What It Doesn't, What I Must Add

You asked 13 questions. Here is the honest scorecard. **⚡ = you asked for it, my earlier pack didn't have it, and it's now specified in the follow-up docs.**

| # | Your question | Answer | Detail / where |
|---|---|---|---|
| 1 | Promote the services? | **Yes — with one hard constraint** | Conversational promotion (anytime, free) + opt-in campaign broadcasts (throttled). ⚠️ Promotional blasts are the #1 WhatsApp ban cause and cost 7.5× more on Meta. See §2 |
| 2 | Do appointments? | **Yes** | Slot booking + committed slot + live token. See `08` |
| 3 | Answer enquiries from their own data? | **Yes — via a knowledge base built from their website, GBP, price list & photos** | Needs a RAG layer + ingest pipeline. ⚡ **New module.** See `07` §5 |
| 4 | Can the client check status of every lead? | **Yes** | Lead pipeline + patient-facing `/s/:token` status page + "status" keyword. ⚡ **New.** See `07` §2 |
| 5 | Potential revenue tracking? | **Yes** | Pipeline value, booked, collected, recovered, leak report. ⚡ **New.** See `07` §3 |
| 6 | Follow-up to enquiries who didn't book? | **Yes** | Drip sequence + stop rules + ban-safety caps. ⚡ **New.** See `07` §4 |
| 7 | Complete business solution? | **It becomes one after `07` is built — not before** | Today's pack is a queue+front-desk product. Adding lead CRM + KB + campaigns makes it a front-office suite. Honest scope: ~4–6 weeks of build |
| 8 | Connect to Google Business / their website and extract info? | **Website yes, GBP partially** | Website crawl = full. GBP = hours/address/rating/5 reviews via Places API; full Business Profile API needs Google approval. See `07` §5.3 |
| 9 | Ask for review after every successful appointment, but not if already reviewed? | **Yes, with a caveat you must read** | De-dup logic is buildable; *reliable* "already reviewed?" detection is not, without Google API approval. ⚠️ Also: rating-gating violates Google policy. See §3 below |
| 10 | Approximate schedule time ("aapka number 10 baje aayega")? | **Yes — committed slot + rolling ETA + confidence band + leave-by time** | See `08` §3 |
| 11 | Far-away patients get accurate timing so they arrive on time? | **Yes** | GPS pin or locality travel-time table → "ghar se 9:45 niklein". See `08` §4 |
| 12 | Multiple doctors/stylists, each with own customers and own service durations — does it auto-adjust and assign without confusing the customer? | **Yes — this is the core of the scheduling engine, and it's the best part** | Per-provider independent queues + per-provider EWMA + load-balancing assignment. Worked example with 3 doctors × 3 patients in `08` §2 |
| 13 | Strictly WhatsApp automation, not TV setup or staff training? | **Understood — repositioning the product** | TV becomes an optional self-serve module. Setup fee model changes. Revised pricing + client requirement checklist in `09` |

---

## 1. The repositioning you just asked for (and what it costs you)

You said: **strictly WhatsApp automation, no TV setup, no staff training.** That is a smart narrowing — it makes the product sellable by phone, deliverable by you alone, and scalable past Ludhiana. But it has three consequences you should accept deliberately:

**✅ What gets better**
- **Zero on-site delivery.** No travel, no scheduling, no installations. A clinic can go live the same evening you speak to them.
- **Price becomes a subscription story, not a labour story.** ₹999–₹3,999/month recurring, which is what makes this a company and not a consultancy.
- **No hardware objections, no "TV konsa lena hai", no Android TV version problems.**
- **Sells on the phone.** Your 90-day plan no longer needs 20 walk-ins a day.

**⚠️ What gets weaker**
- **The ₹14,999 setup fee loses its justification.** In my earlier pack, 60–70% of that fee was on-site work (TV install, training, day-1 supervision). Without it, you cannot honestly charge ₹15,000 for "configuration". Drop the headline setup to **₹2,999–₹7,500** and protect ARPU with modules instead (see `09` §2 for the revised table). Chasing the same ₹14,999 without the labour makes you look expensive and slows closes.
- **You lose the single most persuasive demo moment.** A doctor watching his own TV say *"Token 12, Cabin 1"* is worth more than any dashboard. **Mitigation:** keep the TV as a *free 7-day trial link* you send on WhatsApp — `baari.clinic/tv/your-clinic`. He taps it on the TV in his waiting room, and it works with zero setup from you. That preserves the wow, costs you nothing, and becomes a paid add-on later.
- **Activation risk rises.** On-site setup is what made pilots convert. Without it, owner activation depends entirely on your onboarding flow being excellent — which is exactly why `09` specs a WhatsApp-native Setup Chat instead of a dashboard.

**Decision I recommend:** reposition the *core* as WhatsApp-only, keep TV + training as clearly-priced **add-on modules**, and never lead with them. You keep the one-time fee (for activation, not labour) but it is small and clearly earned.

---

## 2. Promotion on WhatsApp — read this before you promise it to anyone

Your instinct ("can it promote services?") is right, but WhatsApp has a cost model that punishes generic promotion, and your chosen lane (Baileys QR) has a ban model that punishes it worse.

**What is safe (build freely):**
| Promotion type | Lane | Cost | Risk |
|---|---|---|---|
| Answering "aapke yahan kya kya hota hai?" / "cleaning ka kitna?" **in conversation** | Baileys/Meta service window | **₹0** | None |
| Sending service catalogue + prices when a patient asks | both | ₹0 | None |
| Recall messages tied to a *prior visit* ("35 din ho gaye, haircut due") | both, utility category | ₹0 Baileys / ₹0.115 Meta | Low, if opted-in |
| Slot-filler broadcast to *that clinic's existing patients* ("aaj 4 baje slot khali hai, 20% off") | **Meta official lane only** | ₹0.86/msg | Medium — must be opted-in, must be marketing-consented |
| "Diwali offer" blast to 4,000 numbers | ❌ Baileys | — | **Account death.** Never build this |

**The rule to bake into the product:**
> On the Baileys lane, promotional messages are allowed **only inside an open conversation** (patient messaged in the last 24h) and **only to patients with `consent.marketing = true`**. Everything outside that is queued, not sent, and the UI says: *"Yeh campaign Official WhatsApp API se hi jayegi — ₹0.86/message."*

That single guardrail is the difference between a product that survives 18 months and one that gets 20 clinics banned in month 3. Build the campaign module with the guardrail **inside** it, not bolted on.

**Design for promotion that works in India without blasting:**
1. **Slot-filler** (best ROI, zero spam): at 11 AM and 4 PM, if today has empty slots, message only patients with an upcoming *or recent* relation to the clinic: *"Aj 4:00 PM ka slot khali ho gaya hai — ₹300 (normal ₹500). Book karein?"* — 6–15 recipients, all consented, no ban risk.
2. **Service-of-the-month to the recall list**, not the whole database.
3. **Instagram/WhatsApp status-style catalogue**: a clean `/b/:slug` page with services + prices that the clinic forwards itself — free distribution, zero risk.

---

## 3. ⚠️ The review-gating problem (this one is a genuine legal/policy risk)

My earlier spec (and most Indian clinic-software products) does this:

> 4–5★ → send Google review link · 1–3★ → route privately to owner

**That is "review gating" and it violates Google's review policies.** Google's prohibited-content policy explicitly disallows selectively soliciting positive reviews. Consequences are real: reviews can be filtered out, and in repeat cases the Business Profile can be suspended — which for a dental clinic is a catastrophic outcome, and you would be the vendor who caused it.

**What to build instead (and it still gets them the reviews):**

```
Patient marks visit done
        ↓  (after N hours, default 2, never 21:00–08:00)
"How was your experience today? 1–5"
        ↓
ANY rating (1–5):
   ├── "Dhanyavaad! Ek chhoti si help — Google pe 30 second me likh dein:
   │     ⭐ <google review deep link>"
   └── always also: "Kuch theek nahi laga? Seedha Dr. Sharma ko bataein (private)"
        ↓
Private feedback ALSO fires an owner alert with the rating & comment
```

- **Google link is offered to everyone** → compliant.
- **Private feedback channel is offered to everyone** → you still catch the 2★ before it becomes public, because the *unhappy* patient is told "you can also tell the owner directly". In practice 60–70% of unhappy patients pick the private channel when it's offered alongside.
- The owner gets the early-warning alert **regardless** of what the patient chose. That's the actual business value — the "shield" was never really about hiding bad reviews, it was about **hearing them early**.

Offer the gated version only as an explicit, labelled `compliance_mode: 'gating_risk'` setting that you *do not* enable by default and *do not* advertise. Better: don't ship it at all. Sell the early-warning version — it's a stronger pitch ("aapko 2★ pehle pata chal jayega"), and it can't get your customer's GBP suspended.

**Detecting "already gave a review" — the honest limits:**
| Approach | Available in v1? | Reliability |
|---|---|---|
| We know we already sent the link for this visit | ✅ | 100% — prevents asking twice for the same visit |
| Patient clicked the link | ✅ (redirect tracking) | 100% |
| Patient actually submitted a Google review | ❌ without Business Profile API | ~60–80% via name + timestamp matching if approved |
| Patient is a serial reviewer | ⚠️ only if API | — |

So: implement ask-once-per-visit + max-2-asks-per-patient-per-6-months + suppress if private feedback ≤3★ + suppress if `do_not_ask`. That eliminates the annoyance (which is what actually matters) even without Google's API. Be honest with clinics: *"Hum review ki guarantee nahi de sakte, par hum dobara-dobara nahi poochhenge."*

---

## 4. What "complete business solution" still won't cover (say this out loud in sales calls)

Even after building `07`, `08`, `09`, Baari is a **front-office automation layer**, not a full clinic management system. It does not (and should not, v1) do:

- Billing/GST invoices for patient consultations · pharmacy · IPD/ward management · dental charting · EMR/prescriptions · insurance/TPA claims · inventory · payroll · accounting/Tally.

That's a strength, not a gap: it means you integrate *alongside* Practo/MocDoc instead of fighting them, it keeps you out of ABDM/HIS compliance scope, and it keeps your build small enough to ship. The line to use: **"Hum aapke software ko replace nahi karte — hum unke saamne baithne wala patient sambhalte hain."**

---

## 5. Revised build order (what changes in the plan)

The new modules slot in **before** the lab module, because leads + follow-ups + KB are what make the monthly fee defensible.

```
M1  schema + seed + mock tenant                    (existing)
M2  auth + tenant + RLS proof                      (existing)
M3  queue engine + /desk 4 buttons                 (existing)
M4  ⚡ multi-provider scheduling + ETA + load balance   → doc 08   [5–6 days]
M5  ⚡ lead CRM + pipeline + status page + revenue     → doc 07 §2–3 [6–7 days]
M6  ⚡ follow-up sequences + campaigns (guarded)       → doc 07 §4   [4–5 days]
M7  ⚡ knowledge base ingest (web/GBP/PDF/IG) + grounded answers → doc 07 §5 [6–8 days]
M8  ⚡ review de-dup + complaint early-warning         → doc 07 §6   [3 days]
M9  ⚡ WhatsApp Setup Chat (self-serve onboarding)     → doc 09 §3   [4–5 days]
M10 billing (UPI QR + Razorpay) + plan gating                       [4 days]
M11 lab module (vision → quote → collection → report)               [7–8 days]
M12 TV display (self-serve link, no install) — now an ADD-ON        [3 days]
M13 recall + jobs + admin + hardening                               [6 days]
                                                          Total ≈ 9–11 weeks, 1 dev
```

**If you can only ship one thing this month:** M3 + M4 (queue + multi-doctor ETA). That alone is sellable at ₹1,999/mo and answers the pain your market feels *daily*. Leads, KB and campaigns are what let you charge ₹3,999 later — they are month 2–3, not week 1.
