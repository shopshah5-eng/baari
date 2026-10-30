# BAARI — WhatsApp Bot Conversation Spec
**Lanes:** Baileys QR (default, per-tenant, free messages) → Meta Cloud API (failover / official add-on).
**Languages:** Hindi, Hinglish (default), Punjabi, English. Auto-detect from the patient's first message; persist per patient; manual override by replying `1` Hindi / `2` Punjabi / `3` English.
**Modality:** text, **voice notes (Gemini 2.5 Flash native audio input — no separate STT)**, images (prescriptions), WhatsApp location pins, and interactive list/button messages where the lane supports them.

---

## 1. Design principles for the bot

1. **Never a menu tree deeper than 2 levels.** A patient in pain will not type `4` to reach `Billing`.
2. **Answer in ≤ 5 seconds.** Typing indicator immediately, reply within 3–5 s. Slow bots get "hello?" spam.
3. **Always confirm in the patient's own words.** If they said "daant me dard", the reply says *"Daant ke dard ke liye"* — proof of listening.
4. **Every message ends with a next action**, never a dead end.
5. **Free-form AI for understanding, structured code for state.** Gemini classifies intent + extracts slots; deterministic handlers own the state machine. **Never let the LLM write a token number, a price, or a time by itself** — it fills slots, the engine composes the message.
6. **Never send more than 3 messages in a row.** No broadcast storms.
7. **Opt-out is one word:** `STOP` → suppressed from all non-transactional messages forever, logged, and honoured across tenants by phone hash.

---

## 2. Intent taxonomy (what Gemini must return)

```json
{
  "intent": "BOOK_TODAY | BOOK_LATER | JOIN_LINE | ASK_WAIT | ASK_PRICE | LAB_QUOTE |
             HOME_COLLECTION | REPORT_STATUS | RESCHEDULE | CANCEL | HUMAN |
             EMERGENCY | FEEDBACK | GREETING | OTHER",
  "mode_fit": "clinic | lab | salon",
  "specialty_or_service": "dental | skin | pedia | ortho | eye | general | null",
  "provider_name": "Dr Sharma | null",
  "preferred_time": {"raw": "aaj shaam", "resolved": "2026-10-29T18:00:00+05:30", "confidence": 0.8},
  "symptoms_or_tests": ["daant me dard"],
  "location_shared": false,
  "language": "hi | pa | en | hinglish",
  "urgency": "normal | urgent | emergency",
  "is_new_patient": null,
  "needs_human": false
}
```
Rules: if `confidence < 0.6` on any slot that is *required to act*, ask **one** clarifying question (never two). If `needs_human` or `EMERGENCY`, escalate immediately — emergency bypasses everything and pings the reception desk with a red banner.

---

## 3. Core flows (with exact copy)

### 3.1 First contact — the 3-second aha
**Patient:** *(voice note)* "Dr. Sharma ko aaj shaam dikhana hai, daant me bahut dard hai"

**Baari (within ~4 s):**
> 🙏 Namaste! *Dr Sharma Dental, Model Town*
> Daant ke dard ke liye aaj shaam ka slot check kar raha hoon…

then, after the engine answers:

> ✅ **Aapki baari pakki!**
> 🎫 Token **#18**
> 👨‍⚕️ Dr. Sharma · Cabin 1
> 🕕 Anumaanit samay: **6:15 PM**
> 📍 Model Town, Ludhiana
>
> Abhi ghar se **5:45 PM** nikalna theek rahega.
>
> `[ ✅ Aa raha hoon ]`  `[ 🔄 Badalna hai ]`  `[ 📍 Location bhejein ]`
>
> *Jab aap se pehle sirf 2 log bachenge, main aapko yahin message kar dunga.*

**Why this works:** token + time + address + departure time + one-tap confirm, in one screen. No app, no link, no login.

**If the doctor is full:**
> 😔 Aaj shaam Dr. Sharma ki line full hai (next: Token 34).
> Do options hain:
> 1️⃣ **Aaj hi line me lag jayein** — token milega, par wait ~50 min ho sakta hai
> 2️⃣ **Kal subah 10:30 AM** — pakka slot, koi wait nahi
>
> Kaunsa theek hai? (`1` ya `2` likh dein)

### 3.2 Walk-in at the desk (receptionist adds, patient gets the token)
> 🎫 **Token #24** — *Dr Sharma Dental*
> Abhi chal raha hai: **#19**
> Aapse pehle **4 log** · Anumaanit: **~7:10 PM**
> Aap yahin baith sakte hain — 2 log pehle bachein to main message kar dunga. 🙂

### 3.3 The flagship: 2-ahead alert
> 🔔 **Ritu ji, ab nikalne ka time hai!**
> Aapki baari ~**15 min** me. Aapse pehle sirf **2 log** hain.
> 🎫 Token #14 · Dr. Sharma · Cabin 1
>
> `[ ✅ Nikal raha hoon ]`  `[ ⏰ 15 min late ]`

**Trigger guardrails:** `position_ahead ≤ 2` · not already checked-in · not sent in last 60 min · only during clinic hours · **never between 10 PM and 7 AM**.

### 3.4 "Mera number kab aayega?" (the most common inbound)
Engine answers instantly — **this message alone pays for the product**.
> Aap **#14** hain. Abhi **#12** chal raha hai.
> ⏱ Aapki baari ~**12 minute** me (approximately 6:15 PM).
> Aapse pehle: 2 log.
> *(Yeh message apne aap bheja gaya hai — reception ko call karne ki zarurat nahi. 🙏)*

### 3.5 Doctor delayed
> ⏸ **Doctor sahab 15 minute late hain** (emergency case).
> Aapka naya anumaanit samay: **6:30 PM**.
> `[ ✅ Theek hai ]` `[ 🔄 Reschedule ]`
> *Pareshani ke liye maaf kijiye. 🙏*

### 3.6 Emergency jump (broadcast to all waiting)
> 🚨 Ek **emergency case** aa gaya hai — unhe pehle dekha jayega.
> Aapka number ~10 minute late chalega. Dhanyavaad samajhne ke liye 🙏

### 3.7 No-show recovery (fired at `SKIPPED`)
> Aapka number **#14** tha, par aap nahi mile.
> Koi baat nahi 🙂 — abhi bhi **#15** chal raha hai.
> `[ 🔄 Line me wapas lagao ]` `[ 📅 Kal ka slot ]`

### 3.8 Slot reminder (T-2h) — the no-show killer
> ⏰ **Aaj 6:15 PM** — Dr. Sharma, Cabin 1
> 🎫 Token #18 · Model Town
> `[ ✅ Aa raha hoon ]`  `[ 🔄 Time badalna hai ]`  `[ ❌ Cancel ]`
> *2 ghante pehle confirm karne se line tez chalti hai — dhanyavaad!*

`[🔄 Time badalna hai]` → offers max 3 alternate slots (never a calendar):
> 3 options hain — kaunsa?
> 1️⃣ Aaj 7:30 PM (Dr. Sharma)
> 2️⃣ Kal 10:30 AM (Dr. Sharma)
> 3️⃣ Kal 6:00 PM (Dr. Kaur)

### 3.9 Post-visit review shield (T+2h)
> 🙏 Dr. Sharma Dental — aaj aane ke liye dhanyavaad!
> Aapka experience kaisa raha? (1 se 5)
> `1` `2` `3` `4` `5`

**4–5★:**
> Bahut dhanyavaad! 🙏 Ek chhoti si help — Google pe 30 second me review likh dein, isse clinic ko bahut farak padta hai:
> ⭐ https://g.page/r/xxxx/review

**1–3★:**
> Maaf kijiye, aapka experience achha nahi raha. 🙏 Aapki baat **seedha Dr. Sharma** tak pahunch rahi hai.
> Ek line me bata dein kya gadbad hui? (Yeh review public nahi hoga.)
> → routed to owner's private WhatsApp with `⚠️ 2★ — Ritu, 98xxxx — "waiting bahut lambi thi"` and **no public review link is ever sent**.

**This is the single highest-ROI feature for retention.** Doctors renew for reviews, not for queues.

### 3.10 Recall engine
> ✂️ *Glam Studio*: Ritu ji, aapka last haircut **35 din pehle** tha. Is hafte **20% off** Wednesday–Thursday?
> `[ 📅 Slot book karein ]` `[ 😴 Baad me ]`

> 🦷 *Dr Sharma Dental*: Aapki **6 mahine ki dental checkup** due hai. 10 minute ka checkup, ₹300.
> `[ 📅 Book ]` `[ ❌ Nahi ]`

Recall copy lives in the **utility** category (appointment-related, opted-in), not marketing — keeps Meta costs at ₹0.115 not ₹0.8631, and keeps the number healthy.

---

## 4. Lab module flows

### 4.1 Prescription photo → quote (the killer flow for labs)
**Patient:** *(photo of handwritten prescription)* "Kitna kharcha aayega? Blood sample ghar aaoge?"

**Step 1 — instant acknowledgement (≤2 s, before Vision finishes):**
> 📸 Prescription mil gaya! Padh raha hoon… ek minute 🙏

**Step 2 — Vision result (≤8 s):**
> 🧪 **Aapke tests:**
> • CBC — ₹250
> • LFT — ₹600
> • TSH — ₹250
> **Total: ₹1,100** *(Home collection ₹150 extra)*
>
> ⏳ **Fasting:** 10–12 ghante kaafi hai. Kal subah khaali pet aayein.
> 🏠 **Ghar se sample** ho sakta hai — subah 7–9 baje.
>
> `[ 🏠 Ghar se sample ]`  `[ 🏥 Lab par aata hoon ]`  `[ ✏️ Test galat hai ]`

**Step 3 — capture address via WhatsApp location pin:**
> Perfect! Apna **location pin** bhej dein (📎 → Location → Send your current location), taki hamari **didi subah 7–9 baje** pahunch sake. 📍
> *(Ya apna pura address type kar dein.)*

**Step 4 — confirmation:**
> ✅ **Booking confirm!**
> 🧪 CBC, LFT, TSH (₹1,100 + ₹150)
> 📍 Sector 32, Ludhiana
> 🕖 Kal, **7:00–9:00 AM** · Technician: Sunita
> 💳 Payment: cash / UPI at collection
> *Khaali pet aayein. Paani pi sakte hain.*
> `[ ❌ Cancel ]`

**Step 5 — report delivery:**
> 📄 **Aapki report taiyar hai!**
> Ritu Sharma · 29 Oct 2026
> [PDF attached]
> Sab normal range me hai. Koi bhi value highlight nahi hui.
> Dr. Sharma ko dikhana zaroori hai — appointment chahiye?
> `[ 📅 Dr. Sharma ka slot ]` `[ 📄 Report dobara bhejein ]`

> ⚠️ **Never generate clinical interpretation.** "Sab normal hai" is stated **only** when every value is within range and the clinic enabled it; any out-of-range value routes to `"Kuch values range se bahar hain — doctor se zaroor milein"` with **no diagnosis, no severity, no medicine**. This is a compliance wall, not a style choice.

**Low-confidence Vision:** if any test's confidence <0.85, the quote includes *"✏️ Agar koi test chhoot gaya ho to bata dein"* and the lab desk gets a review card. Never silently quote on a blurry photo.

---

## 5. Escalation to human
Triggered by: `HUMAN`, `EMERGENCY`, 2 consecutive low-confidence turns, 3 unparsed messages, or any angry keyword (`complaint`, `shikayat`, `galat`, `paisa wapas`).
> Main aapki baat **clinic ki reception** tak pahuncha raha hoon — 2 minute me jawab milega. 🙏
> Turant baat karni ho to: 📞 0161-XXXXXXX

Desk gets: red banner + sound + `[ Reply ]` inline. Human takes over the thread; bot stays silent for 30 min after.

---

## 6. Message templates to get approved (Meta lane) / pre-write (Baileys lane)

| # | Name | Category | Variables |
|---|---|---|---|
| 1 | `token_issued` | Utility | clinic, token, provider, time, address |
| 2 | `queue_position` | Utility | token, now_serving, ahead, eta |
| 3 | `two_ahead_alert` | Utility | name, token, minutes, provider, cabin |
| 4 | `delay_notice` | Utility | extra_minutes, new_time |
| 5 | `slot_reminder_2h` | Utility | time, provider, token |
| 6 | `no_show_recovery` | Utility | token |
| 7 | `lab_quote` | Utility | tests, total, fasting |
| 8 | `lab_report_ready` | Utility | pdf, date |
| 9 | `review_ask` | Utility | g.page link |
| 10 | `recall_reminder` | Utility | service, offer |
| 11 | `emergency_broadcast` | Utility | extra_minutes |

Keep every one of these **purely transactional** — adding "20% off this Diwali" to a token message reclassifies it as Marketing on Meta's card and multiplies your cost by 7.5×.

---

## 7. Prompt skeleton (Gemini 2.5 Flash)

**System (short, versioned, cached):**
```
You are Baari, the WhatsApp receptionist for {{business_name}}, a {{mode}} in {{city}}.
Today is {{date}}, time now {{time}} (IST). Open: {{hours}}.
Providers: {{provider_list_with_avg_minutes}}.
Services: {{service_list_with_prices}}.
Today's live queue state: {{queue_json}}.

Your job: understand what the patient wants, in Hindi/Hinglish/Punjabi/English or a voice
note, and return ONLY the JSON schema given. Never invent a token number, price, slot or
time — those come from the system. If unsure, set needs_human=true. Be warm and brief.
Never give medical advice, diagnosis, or medicine names.
```
**Then** a deterministic composer builds the actual message from the JSON + live engine state. **The model never free-generates patient-facing copy for anything involving numbers, money or time.**

**Cost control:** ~1 Gemini 2.5 Flash call per inbound message (~₹0.05–₹0.15), plus ~1 vision call per prescription (~₹0.5–₹1). At 2,000 patients/month that is well under ₹500/month — inside the ₹1,999 plan.

---

## 8. Anti-ban discipline (Baileys lane)

| Rule | Setting |
|---|---|
| Only message people who messaged you, or who gave a number at the desk | hard rule in code |
| Warm-up | days 1–3: ≤20 msgs/day → day 7: ≤100 → day 30: ≤500 (per tenant number) |
| Randomised human delay | 3–12 s before send, typing indicator first |
| No identical bulk blasts | merge-variable personalisation + jitter |
| Media as documents, not spammy links | PDFs as documents, not shorteners |
| Opt-out honoured instantly | `STOP` → suppressed table + never re-add |
| Session health monitor | detect `401/loggedOut` → alert owner + auto-failover to Meta lane if connected |
| Never send between 21:00–08:00 | queue and hold |
| Per-tenant isolation | one Baileys session per tenant, own auth folder, own number — **never share** |

**Failover ladder:** Baileys (0–3 s) → Meta Cloud API (if connected, +2–5 s) → SMS (if DLT approved) → desk beep. The reception console shows which lane is live at all times (`🟢 WA · QR` / `🟢 WA · Official`).
