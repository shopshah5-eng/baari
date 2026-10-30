'use strict';
/* The 12-question setup chat (docs/09 §3). Never blocks go-live: every unanswered
   field falls back to a mode preset, and the answer itself configures the tenant. */
const S = require('./store');
const KB = require('./kb');

const SETUP = [
  { k: 'mode', q: 'Aapka setup kaunsa hai?', type: 'choice', opts: [['clinic', '🩺 OPD Clinic / Hospital'], ['lab', '🧪 Diagnostic Lab'], ['salon', '✂️ Salon / Spa']] },
  { k: 'name', q: 'Clinic / business ka naam aur area? (jaise "Dr Sharma Dental, Model Town")', type: 'text' },
  { k: 'phone', q: 'Clinic ka WhatsApp number kaunsa hai? (10 digit)', type: 'text' },
  { k: 'google', q: 'Google pe aapki listing hai? Link bhejein, ya "nahi" likh dein.', type: 'text' },
  { k: 'website', q: 'Aapki website hai? URL bhejein, ya "nahi".', type: 'text' },
  { k: 'providers', q: 'Kaun kaun milta hai? (jaise: Dr Sharma - 12 min, Dr Kaur - 8 min)', type: 'text' },
  { k: 'hours', q: 'Timing kya hai? (jaise: 10-2, 5-8, Sunday band)', type: 'text' },
  { k: 'services', q: 'Top 5 services aur price? (jaise: Consult 300, Scaling 1200, RCT 4500)', type: 'text' },
  { k: 'answer_ai', q: 'WhatsApp pe enquiry ka jawab khud dena hai aapki info se?', type: 'choice', opts: [['yes', '✅ Haan'], ['no', '❌ Nahi']] },
  { k: 'review', q: 'Google review maangna hai? Review link bhejein (GBP → Ask for reviews), ya "nahi".', type: 'text' },
  { k: 'payment', q: 'Payment UPI QR se karenge ya Razorpay link se?', type: 'choice', opts: [['upi', '📱 UPI QR'], ['razorpay', '💳 Razorpay']] },
  { k: 'confirm', q: 'Sab set! Chalu karein?', type: 'choice', opts: [['go', '✅ Chalu karein'], ['edit', '✏️ Kuch badalna hai']] }
];

const PRESETS = {
  clinic: [['Consultation', 300, 10], ['Scaling', 1200, 30], ['Root Canal (RCT)', 4500, 45], ['Extraction', 800, 20]],
  lab: [['CBC', 250, 5], ['LFT', 600, 5], ['TSH', 250, 5], ['Home collection', 150, 5]],
  salon: [['Haircut', 300, 30], ['Beard trim', 150, 15], ['Hair colour', 1500, 60], ['Facial', 1200, 45]]
};

function seedPresets(o) {
  PRESETS[o.mode].forEach(([n, p, d]) => S.load().services.push({ id: S.id('sv'), org_id: o.id, name: n, price: p, duration_min: d, active: true }));
  S.load().providers.push({ id: S.id('pv'), org_id: o.id, name: 'Doctor 1', code: 'D1', specialty: '', room: 'Cabin 1', avg_minutes: 10, speed_factor: 1, hours: {}, active: true });
  KB.seed(o);
}

function answer(o, k, value) {
  o.setup = o.setup || {};
  o.setup[k] = value;
  const d = S.load();
  if (k === 'services') {
    d.services = d.services.filter(s => s.org_id !== o.id);
    String(value).split(/[,;]/).forEach(part => {
      const m = part.trim().match(/^(.*?)\s+(\d+)$/);
      if (m) d.services.push({ id: S.id('sv'), org_id: o.id, name: m[1].trim(), price: Number(m[2]), duration_min: 15, active: true });
    });
  }
  if (k === 'providers') {
    d.providers = d.providers.filter(p => p.org_id !== o.id);
    String(value).split(/[,;]/).forEach((part, i) => {
      const m = part.trim().match(/^(.*?)[\s-]+(\d+)\s*(?:min)?$/);
      if (m) d.providers.push({ id: S.id('pv'), org_id: o.id, name: m[1].trim(), code: 'D' + (i + 1), specialty: '', room: 'Cabin ' + (i + 1), avg_minutes: Number(m[2]), speed_factor: 1, hours: {}, active: true });
    });
  }
  if (k === 'google' && /^https?:/.test(value)) { o.settings.maps_url = value; KB.add(o.id, { source: 'gbp', title: 'Google listing', text: 'Google Business listing: ' + value }); }
  if (k === 'review' && /^https?:/.test(value)) o.settings.google_review_url = value;
  if (k === 'website' && /^https?:/.test(value)) KB.ingestUrl(o.id, value);
  if (k === 'mode') { o.mode = value; }
  if (k === 'name') { o.name = String(value).split(',')[0].trim(); o.area = (String(value).split(',')[1] || o.area).trim(); }
  if (k === 'phone') { const p = require('./security').normPhone(value); o.phone = p; o.owner_phone = o.owner_phone || p; o.staff_phones = [p]; o.wa = { ...(o.wa || {}), phone: p }; }
  if (k === 'hours') o.hours = { raw: value };
  if (k === 'confirm' && value === 'go') { o.plan = 'pilot'; o.live = true; }
  S.save();
  return o;
}

module.exports = { SETUP, questions: () => SETUP.map(({ k, q, type, opts }) => ({ k, q, type, opts })), answer, seedPresets, PRESETS };
