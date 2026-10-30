# BAARI — Multi-Provider Scheduling & ETA Engine
**This is the answer to: "3 doctors, 3 patients each, different service durations — will it adjust automatically without confusing the customer?"**
**Yes. Here is exactly how, with worked numbers.**

---

## 1. The mental model (get this right in one paragraph)

There is **no global queue**. There are **N independent per-provider queues** running in parallel, each with its own speed. The only global objects are:

1. **The schedule graph** — who is working when, what they can do, how long it takes.
2. **The assignment logic** — when a patient has no preference, which provider do we put them with?
3. **The ETA function** — for each patient, *their* provider's queue ahead of them.

Everything the patient ever sees is derived from **their own provider's queue**. That is precisely why nothing gets confusing: the patient is never told "abhi 62 chal raha hai". They are told *"Dr. Kaur · Token K-04 · ~10:25 AM"*.

### Token numbering — the decision that prevents most confusion
| Option | Example | Verdict |
|---|---|---|
| Shared counter across all doctors | "Token 87" | ❌ Meaningless: 87 on a 3-doctor day tells nobody anything |
| Per-provider numbering with prefix | **`S-12` (Dr Sharma), `K-04` (Dr Kaur), `V-31` (Dr Verma)** | ✅ **Ship this** |
| Per-provider, spoken form | "Dr. Sharma, token 12" | ✅ Always pair the prefix with the name in every message |

Rule: the token string is `{provider_code}-{number}`, but **every patient-facing message also says the doctor's name**. Never send a bare number.

---

## 2. Worked example — 3 doctors × 3 patients (your exact scenario)

### 2.1 The setup as configured at onboarding
| Provider | Service | Configured avg | Working |
|---|---|---|---|
| **Dr. Sharma** (`S`) | General consult | **12 min** | 10:00–14:00, 17:00–20:00 |
| **Dr. Kaur** (`K`) | Skin consult | **6 min** | 10:00–14:00 |
| **Dr. Verma** (`V`) | Ortho consult | **15 min** | 10:30–14:00 |

### 2.2 Nine patients. Nobody has a preference. It's 10:00.
Assignment algorithm: **earliest-available provider** (unless the patient names one, or has consulted someone before — then that provider wins with a +1 bias).

```
avail(p) = max(now, provider_ready_at(p)) + Σ(remaining durations of p's active queue) + overrun(p)
```

| # | Patient asks at | Candidates & their avail times | Assigned | Stated ETA | Message they get |
|---|---|---|---|---|---|
| 1 | 10:00 | S→10:00 · K→10:00 · V→10:30 | **S** | ~10:00 | `S-01 · ~10:00 AM (abhi)` |
| 2 | 10:00 | S→10:12 · K→10:00 · V→10:30 | **K** | ~10:00 | `K-01 · ~10:00 AM (abhi)` |
| 3 | 10:01 | S→10:12 · K→10:06 · V→10:30 | **K** | ~10:06 | `K-02 · ~10:05 AM` |
| 4 | 10:02 | S→10:12 · K→10:12 · V→10:30 | **S** | ~10:12 | `S-02 · ~10:12 AM` |
| 5 | 10:03 | S→10:24 · K→10:12 · V→10:30 | **K** | ~10:12 | `K-03 · ~10:12 AM` |
| 6 | 10:04 | S→10:24 · K→10:18 · V→10:30 | **K** | ~10:18 | `K-04 · ~10:18 AM` |
| 7 | 10:05 | S→10:24 · K→10:24 · V→10:30 | **S** | ~10:24 | `S-03 · ~10:24 AM` |
| 8 | 10:06 | S→10:36 · K→10:24 · V→10:30 | **K** | ~10:24 | `K-05 · ~10:24 AM` |
| 9 | 10:07 | S→10:36 · K→10:30 · V→10:30 | **V** | ~10:30 | `V-01 · ~10:30 AM` |

**Nine patients, three different timings, no confusion** — because each patient's message names *their* doctor, *their* token, and *their* single time window. Nobody is ever shown a number belonging to someone else's line.

> **The one-line rule for the UI:** *a patient is only ever shown their own provider's queue position, never a global position.*

### 2.3 Now the real world happens (this is where competitors break)
At **10:09**, Dr. Sharma's first patient turns out to need an extraction, taking **40 minutes instead of 12**.

```
Overrun on S = 40 - 12 = +28 min  (detected when the token is marked DONE, or via a
                                    "Doctor is running late" tap on /desk)
```

What the engine does, automatically, within 2 seconds:

| Provider | Before | After | Effect |
|---|---|---|---|
| **S** queue | S-02 ~10:12, S-03 ~10:24 | **S-02 ~10:49, S-03 ~11:01** | 2 patients proactively messaged |
| **K** queue | K-03 ~10:12, K-04 ~10:18, K-05 ~10:24 | **unchanged** | Kaur's patients hear nothing — correct, nothing changed for them |
| **V** queue | V-01 ~10:30 | **unchanged** | untouched |

Message to the two affected patients only:
> ⏱ **Timing update** — Dr. Sharma ek complex case me hain, aapka naya samay:
> 🎫 **S-02** · ~**10:45–10:55 AM** (pehle 10:12)
> `[ ✅ Theek hai ]` `[ 🔄 Dr. Kaur se mil sakta hai? ]` `[ 📅 Kal aa jaunga ]`

**The `[🔄 Doosre doctor se mil sakta hai?]` button is the killer feature.** It offers a live re-assignment:
> Dr. Kaur ke paas **10:30 AM** khali hai. Wahan shift kar dein?
> `[ ✅ Dr. Kaur, 10:30 ]` `[ ❌ Sharma sahab ka hi intezaar ]`

This single flow converts a lost patient into a seen patient and is worth more than any dashboard.

---

## 3. The ETA function (never show a false number)

```js
// services/eta.js
function etaFor(org, provider, patientToken, now) {
  const svc        = patientToken.service_id;
  const base       = ewma(provider, svc, timeBucket(now))            // learned
                     ?? provider.avg_minutes;                        // configured
  const ahead      = activeTokens(provider, {before: patientToken})  // BOOKED/ARRIVED/CALLED/IN_CONSULT
                     .map(t => remainingMinutes(t, base));           // IN_CONSULT uses elapsed, not base
  const overrun    = Math.max(0, now - currentTokenExpectedDone(provider));
  const breakSoon  = minutesUntilProviderBreak(provider);            // lunch/tea
  return clamp(now + overrun + sum(ahead) + breakSoon, now, endOfDay);
}
```

**Four rules:**
1. **Show a window, not a point.** `~10:15–10:25 AM`, never `10:17`. False precision destroys trust the first time it's wrong by 12 minutes.
2. **Give a departure time, not a wait time.** Patients don't need "18 minutes"; they need *"ghar se 9:55 niklein"*. Compute `leave_by = eta_start − travel_time − 10 min buffer`.
3. **Round to 5 minutes.** And never show a time in the past — if the estimate slipped, say `abhi` (now) and trigger the "we're running late" message.
4. **Recompute on every event:** call, done, skip, hold, delay, emergency, arrival, and a 5-minute heartbeat. Store `eta_at` on the token so the WhatsApp message and the TV always agree.

### Learning (your "it improves as the timing" requirement)
| Signal | What it tunes |
|---|---|
| Actual `called → done` per provider × service × time-of-day | **Replaces the configured avg after 20 observations** (EWMA, α=0.3). "Dr. Verma actually takes 22 min, not 15" — auto-corrected, no admin needed |
| Patient arrival lag (booked for 10:30, checked in 10:42) | Shifts `leave_by` earlier by the observed median lag |
| No-show rate by hour (e.g. 2 PM = 22%) | Suggests controlled overbooking: *"2 PM slot me 20% log nahi aate — ek extra token allow karein?"* |
| Time-of-day complexity (evening OPD slower) | Segments the EWMA into morning/afternoon/evening buckets |
| Cancellation pattern | Adjusts the "how many tokens to allow" cap per slot |

After **2 weeks of use, the system's estimates are better than the doctor's own guess** — and the owner sees it:
> 📈 **Baari seekh raha hai:** Dr. Verma ka actual average **22 min** hai (aapne 15 set kiya tha). Ab ETA sahi aayega. ✅

That message alone increases retention materially, because it *proves* the subscription is doing something.

---

## 4. Committed slot vs rolling ETA (the thing that avoids confusing customers)

Both exist, and they are different promises:

| | **Committed slot** | **Rolling ETA** |
|---|---|---|
| What | "Aapka appointment **6:15 PM** hai" | "Abhi ~6:15–6:30 ka anumaan hai" |
| Set when | Booking | Continuously |
| Broken when | Doctor runs >15 min late | — |
| Never changes | ✅ unless they're messaged | ❌ changes often |
| Who gets it | Appointments | Walk-ins + appointments |

**The rule:** an appointment patient always keeps their committed slot as the *headline*, with the ETA as a *sub-line*. If the ETA drifts more than **15 minutes past the committed slot**, fire an apology + choice:
> 🙏 Dr. Sharma **~20 min late** hain. Aapka slot 6:15 PM tha, ab ~6:35 ka anumaan hai.
> `[ ✅ 6:35 aata hoon ]` `[ 🔄 Time badlein ]` `[ ❌ Cancel ]`

Patients forgive a delay they were told about. They do not forgive silence.

### The three message moments every patient gets
| When | Message | Purpose |
|---|---|---|
| **On booking** | `Token K-04 · 10:18 AM · ghar se 10:05 niklein · Model Town` | They can plan their day |
| **2 patients ahead** | `🔔 Nikalne ka time! ~15 min me aapki baari` | They arrive on time |
| **On call** | `🎫 Aapki baari! Cabin 1 mein aayein` | They walk in |

Plus, for far-away patients: **3 ahead** triggers the nudge instead of 2, if their travel time > 20 min.

---

## 5. Travel time & "ghar se kab niklein"

`travel_time` resolution order:
1. **WhatsApp location pin** (they shared it during booking) → haversine distance → `minutes = clamp(distance_km × 2.2, 8, 60)` for Indian city traffic, adjusted per city (`ludhiana: ×2.4`, metro `×3.0`).
2. **Locality table** — a per-city lookup you maintain for the top 40 localities. Ludhiana example: Model Town↔Sarabha Nagar 12 min,↔Dugri 18, ↔Haibowal 22, ↔Sahnewal 35, ↔Khanna 50.
3. **Default** 20 min, and the message says `(aapka area nahi pata, ~20 min assume kiya hai)`.

Then: `leave_by = eta_start − travel − 10 min buffer`, floored to 5-min increments.

> 🚗 **Aapka samay ~10:18 AM** · Sector 32 se Model Town ~18 min · **Ghar se 9:50 niklein** · 10 min buffer.
> `[ 📍 Location bhejein ]` *— isse timing aur sahi ho jayegi*

---

## 6. Special cases the engine must handle

| Case | Behaviour |
|---|---|
| **Doctor goes to lunch / break is coming** | `minutesUntilProviderBreak` is added to ETAs so nobody is promised 1:55 PM when lunch is 2:00 |
| **Doctor leaves early** | Redistribute the next 3 tokens to other providers only **with patient consent** (one-tap) — never silently move someone's doctor |
| **Provider A is much faster** | Load balancing sends more new patients to A. Cap it: never let one provider exceed **1.4× the least-loaded provider's queue length**, or you'll create a visible unfairness ("main Dr. Sharma ko hi aaunga") |
| **Patient insists on a slow doctor** | Allowed, always. Preference beats optimisation. State the longer wait once: *"Dr. Sharma se 45 min ka wait hai, Dr. Kaur me 10 min — phir bhi Sharma sahab?"* |
| **Emergency** | Insert at position 0 of *that provider's* queue only; other providers unaffected; broadcast a consolidated delay to the affected queue only |
| **A service takes much longer than its slot** (RCT = 45 min, consult = 10) | Durations come from the **service**, not just the provider: `duration = service.duration_min × provider.speed_factor`. This is why booking a 45-min RCT doesn't quietly destroy the whole afternoon |
| **Two receptionists book the same last slot** | Postgres advisory lock on `(org, provider, slot)`; second gets the next available with an explanation |
| **Doctor doesn't press Done** | Auto-close at `2 × expected`; ETA is still corrected because `IN_CONSULT` uses *elapsed time* not expected |
| **Walk-in vs appointment priority** | Appointments get a **10-point priority advantage** at equal arrival time, but a walk-in who arrived 30 min ago is not pushed behind someone who arrives late for a 6:15 PM slot for more than one position |
| **Multi-service visit** (consult + X-ray) | The token carries a service bundle; `remainingMinutes` sums the bundle |

---

## 7. Schema additions for this engine

```sql
alter table providers add column speed_factor numeric(3,2) default 1.0;   -- learned
alter table providers add column hours jsonb;                            -- per-day overrides
alter table services  add column duration_min int;                       -- already present

create table provider_stats (           -- what makes the ETA self-improve
  id bigserial primary key,
  org_id uuid not null, provider_id uuid not null, service_id uuid,
  bucket text not null,                 -- 'morning' | 'afternoon' | 'evening'
  samples int default 0,
  ewma_minutes numeric(6,2),            -- learned duration
  ewma_arrival_lag_min numeric(6,2),    -- how late patients actually show up
  no_show_rate numeric(4,3),
  updated_at timestamptz default now(),
  unique (org_id, provider_id, service_id, bucket)
);

alter table tokens add column committed_at timestamptz;   -- the promise (vs eta_at = truth)
alter table tokens add column leave_by_at timestamptz;    -- computed departure time
alter table tokens add column travel_minutes int;
alter table tokens add column queue_position int;         -- per-provider position, denormalised
```

---

## 8. Test cases that must pass before you ship this module

1. Nine simultaneous bookings across 3 providers produce 9 distinct ETAs and **zero duplicate token numbers**.
2. One provider's 40-minute overrun changes **only that provider's** downstream ETAs.
3. Reassignment flow moves a patient to another provider and their old slot is freed.
4. Two concurrent `book` calls on one last slot → one succeeds, one is told the next available.
5. ETA never returns a past time; it returns `now` and flags lateness.
6. After 20 completed tokens, `ewma_minutes` replaces `avg_minutes` and the delta is logged.
7. A 45-min service booked at 11:00 correctly shifts everyone after it by ~45 min, not 10.
8. Break-time boundary: a patient promised 1:55 PM when lunch starts 2:00 gets 2:30 PM instead.
9. Emergency insert shifts exactly one provider's queue and messages exactly that queue.
10. Kill and restart the API mid-day → all ETAs and positions recompute identically from the event log.
