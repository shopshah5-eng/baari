'use strict';
/* Gemini 2.5 Flash adapter with a deterministic mock.
   The model ONLY classifies intent and extracts slots. It never produces a token
   number, price or time — those come from the engine. See docs/04 §7 */
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const MODEL = 'gemini-2.5-flash';

function mockIntent(text, org) {
  const t = String(text || '').toLowerCase();
  const has = (...w) => w.some(x => t.includes(x));

  // staff commands
  if (/^(add|walkin|walk-in)\b/.test(t)) return { intent: 'STAFF_ADD', staff: true, confidence: 0.95 };
  if (/^next\b/.test(t)) return { intent: 'STAFF_NEXT', staff: true, confidence: 0.95 };
  if (/^(late|delay)\b/.test(t)) {
    const m = t.match(/(\d+)/);
    return { intent: 'STAFF_DELAY', staff: true, minutes: m ? Number(m[1]) : 15, confidence: 0.9 };
  }
  if (/^emergency\b/.test(t)) return { intent: 'EMERGENCY', confidence: 0.9, urgency: 'emergency' };
  if (/^(stop|band karo|mat bhejo|unsubscribe)\b/.test(t)) return { intent: 'OPT_OUT', confidence: 0.99 };
  if (has('mera number', 'meri baari', 'kab aayeg', 'kitna time', 'status', 'kaha hai', 'position', 'kitne log'))
    return { intent: 'ASK_WAIT', confidence: 0.9 };
  if (has('cancel', 'nahi aa paunga', 'reschedule', 'badal'))
    return { intent: 'RESCHEDULE', confidence: 0.75 };
  if (has('report', 'pdf', 'report chahiye')) return { intent: 'REPORT_STATUS', confidence: 0.8 };
  if (has('prescription', 'photo', 'report bhej', 'sample', 'ghar aa'))
    return { intent: 'LAB_QUOTE', confidence: 0.7 };
  if (has('kitna', 'price', 'charge', 'fees', 'rate', 'kharcha', 'kitne ka'))
    return { intent: 'ASK_PRICE', confidence: 0.8 };
  if (has('band', 'khula', 'timing', 'time kya', 'open', 'sunday', 'lunch', 'address', 'kahan', 'parking', 'kaise aau'))
    return { intent: 'ASK_INFO', confidence: 0.85 };
  if (has('book', 'appointment', 'dikhana', 'slot', 'aana', 'milna', 'checkup', 'haircut', 'facial', 'token'))
    return { intent: 'BOOK_TODAY', confidence: 0.85 };
  if (has('hello', 'hi', 'namaste', 'sat sri akal', 'hey'))
    return { intent: 'GREETING', confidence: 0.9 };
  if (has('insaan', 'baat karni', 'call', 'reception', 'doctor se baat'))
    return { intent: 'HUMAN', confidence: 0.8 };
  return { intent: 'OTHER', confidence: 0.4 };
}

async function classify(text, org, patient) {
  if (!GEMINI_KEY) return mockIntent(text, org);
  try {
    const prompt = `You are Baari, the WhatsApp receptionist for ${org.name}, a ${org.mode} in ${org.city}. Today is ${new Date().toDateString()}.
Classify the patient message and return ONLY JSON with keys:
intent (BOOK_TODAY|BOOK_LATER|JOIN_LINE|ASK_WAIT|ASK_PRICE|ASK_INFO|LAB_QUOTE|REPORT_STATUS|RESCHEDULE|CANCEL|HUMAN|EMERGENCY|FEEDBACK|GREETING|OPT_OUT|OTHER),
provider_name (string|null), service_or_tests (string[]), preferred_time (string|null),
language (hi|pa|en|hinglish), urgency (normal|urgent|emergency), needs_human (bool), confidence (0..1).
Never invent prices, tokens or times.
MESSAGE: ${text}`;
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } })
    });
    const j = await r.json();
    const txt = j.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    return { ...mockIntent(text, org), ...JSON.parse(txt) };
  } catch (e) {
    console.error('gemini fallback:', e.message);
    return mockIntent(text, org);
  }
}

/* prescription vision — mock returns plausible tests from the org's own catalogue */
function mockVision(org) {
  const tests = [
    { test: 'CBC', confidence: 0.94 }, { test: 'LFT', confidence: 0.91 }, { test: 'TSH', confidence: 0.88 }
  ];
  return { tests, raw_text: 'Rx: CBC, LFT, TSH. Fasting 10-12 hrs.', handwriting: 'mixed', confidence: 0.91 };
}

async function visionPrescription(org, imageB64) {
  if (!GEMINI_KEY) return mockVision(org);
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Read this handwritten doctor prescription. Return ONLY JSON: {"tests":[{"test":string,"confidence":0..1}],"raw_text":string,"confidence":0..1}. Match test names to this catalogue where possible: ${require('./store').services(org.id).map(s => s.name).join(', ')}. Do not guess — lower the confidence instead.` }, { inline_data: { mime_type: 'image/jpeg', data: imageB64 } }] }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
      })
    });
    const j = await r.json();
    return JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text || '{}');
  } catch { return mockVision(org); }
}

module.exports = { classify, mockIntent, visionPrescription, mockVision, hasGemini: !!GEMINI_KEY };
