'use strict';
/* The WhatsApp conversation machine — the actual product.
   Handles: enquiry answering (grounded), booking, token, status, timing,
   prescription quotes, staff commands, ratings, opt-out, escalation. */
const S = require('./store');
const WA = require('./wa');
const KB = require('./kb');
const AI = require('./ai');
const ETA = require('./eta');
const Q = require('./queue');
const Leads = require('./leads');
const Review = require('./review');

const hi = (org) => org.locale !== 'en';

function ymd(iso) { return new Date(iso).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', ''); }
function dayLabel(iso) { return new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' }); }

async function handle(org, { phone, text = '', type = 'text', geo = null }) {
  const patient = S.patient(org.id, phone);
  const lead = Leads.upsert(org, { phone, source: 'wa_inbound', first_message: text, intent: 'enquiry' });
  WA.inbound(org, phone, type === 'image' ? '[photo]' : type === 'location' ? '[location pin]' : text, type);

  /* ---- opt out, always first ---- */
  const cls = await AI.classify(text, org, patient);
  if (cls.intent === 'OPT_OUT' || /^(stop|mat bhejo)/i.test(text)) {
    lead.do_not_contact = true; S.save();
    return WA.send(org, phone, 'Theek hai 🙏 Aapko aage koi message nahi aayega. Jab zarurat ho, aap khud message kar sakte hain.');
  }

  /* ---- staff commands (works from the receptionist's own phone) ---- */
  if (cls.staff || (org.staff_phones || []).includes(phone)) {
    const r = await staffCommand(org, phone, text, cls);
    if (r) return r;
  }

  /* ---- pending conversation states ---- */
  if (lead.awaiting_rating && /^[1-5]$/.test(text.trim())) {
    const rating = Number(text.trim());
    Review.recordRating(org, phone, rating, lead.awaiting_rating);
    return;
  }
  if (lead.awaiting === 'profile' && ['OTHER', 'GREETING'].includes(cls.intent) && text.length < 40) {
    const parts = text.split(',').map(x => x.trim()).filter(Boolean);
    const p = S.patient(org.id, phone);
    let areaTxt = null;
    if (parts.length >= 2) { if (p) p.name = titleCase(parts[0]); areaTxt = parts[1]; }
    else if (p) p.name = titleCase(parts[0]);
    lead.awaiting = null; lead.name = p ? p.name : lead.name; S.save();
    const tk = latestToken(org, phone);
    if (tk && areaTxt) { tk.travel_minutes = ETA.travelMinutes(org, areaTxt).minutes; Q.recalc(org); }
    if (tk) return sendTokenCard(org, phone, tk);
    return WA.send(org, phone, `Dhanyavaad${p && p.name ? ' ' + p.name.split(' ')[0] : ''}! 🙏`);
  }

  // a pending "which area?" question must never swallow a clear intent:
  // any recognisable intent drops the pending question instead.
  const weakIntent = ['OTHER', 'GREETING'].includes(cls.intent);
  const looksLikeArea = /^[a-zA-Z\s.]{3,30}$/.test(text.trim()) && text.trim().split(/\s+/).length <= 4;
  if (lead.awaiting === 'locality' && !weakIntent) { lead.awaiting = null; S.save(); }
  if (lead.awaiting === 'locality' && weakIntent && looksLikeArea) {
    const t = ETA.travelMinutes(org, text);
    lead.awaiting = null; S.save();
    const tk = latestToken(org, phone);
    if (tk) { tk.travel_minutes = t.minutes; Q.recalc(org); return sendTokenCard(org, phone, tk, { note: `Aapke area se ~${t.minutes} min. Samay update kar diya.` }); }
    return WA.send(org, phone, 'Dhanyavaad! 🙏');
  }

  /* lab: patient tapped "Ghar se sample" */
  if (/ghar se sample|home collection|ghar aa/i.test(text) && org.mode === 'lab') {
    const rx = (S.load().prescriptions || []).filter(r => r.org_id === org.id).slice(-1)[0];
    const pt = S.patient(org.id, phone);
    const c = require('./lab').createCollection(org, {
      prescription_id: rx ? rx.id : null, patient_id: pt ? pt.id : null,
      slot_start: new Date(new Date().setHours(7, 0, 0, 0) + 864e5).getTime()
    });
    lead.stage = 'collection_booked'; lead.probability = 90; lead.awaiting = 'pin'; S.save();
    return WA.send(org, phone,
      `Perfect! Apna *location pin* bhej dein (📎 → Location → Send current location), taki hamari didi subah 7–9 baje pahunch sake. 📍\n\n_Ya pura address type kar dein._`,
      { buttons: ['📍 Location bhejein'] });
  }

  if (type === 'location' && geo) {
    const c = (S.load().collections || []).filter(x => x.org_id === org.id).slice(-1)[0];
    if (c && (!c.geo_lat || c.status === 'scheduled')) {
      c.geo_lat = geo.lat; c.geo_lng = geo.lng; c.status = 'assigned'; c.address_text = c.address_text || 'WhatsApp pin';
      S.event(org.id, 'collection_pin', { id: c.id, lat: geo.lat, lng: geo.lng });
      S.save();
      lead.awaiting = null; S.save();
      return WA.send(org, phone,
        `📍 Location mil gaya!\n\n✅ *Home collection confirm*\n🧪 Tests: ${c.prescription_id ? 'prescription ke hisaab se' : 'scheduled'}\n🕖 Kal *7:00–9:00 AM*\n👩‍🔬 Technician: ${(S.providers(org.id)[0] || {}).name || 'assigned'}\n💳 Payment: cash / UPI at collection\n\n_Khaali pet aayein. Paani pi sakte hain._`,
        { template: 'collection_booked' });
    }
  }

  /* patient sent a text address while we were waiting for the pin */
  if (lead.awaiting === 'pin' && text.length > 8 && !geo) {
    const c = (S.load().collections || []).filter(x => x.org_id === org.id).slice(-1)[0];
    if (c) { c.address_text = text.slice(0, 160); c.status = 'assigned'; S.save(); }
    lead.awaiting = null; S.save();
    return WA.send(org, phone, `Address note kar liya ✅\n\n🕖 Kal *7:00–9:00 AM* — humari didi aa jayegi.\nKhaali pet aayein, paani pi sakte hain. 🙏`, { template: 'collection_booked' });
  }

  if (type === 'location' && geo) {
    const tk = latestToken(org, phone);
    const km = tk && org.settings && org.settings.demo_km ? org.settings.demo_km : 6;
    const mins = ETA.travelFromPin(km);
    if (tk) { tk.travel_minutes = mins; Q.recalc(org); }
    return WA.send(org, phone, `📍 Location mil gaya (${geo.lat}, ${geo.lng}).\nAapke yahan se clinic ~${mins} min hai.\n\n${tk ? `Aapka token ${Q.tokenLabel(org.id, tk)} · ghar se ${ymd(tk.leave_by_at)} niklein.` : ''}`);
  }

  if (type === 'image') {
    return labQuote(org, phone, lead);
  }

  switch (cls.intent) {
    case 'GREETING':
      return WA.send(org, phone,
        `🙏 Namaste! *${org.name}*${org.area ? ', ' + org.area : ''}\n\nMain aapki kya madad kar sakti hoon?\n\n` +
        `1️⃣ Aaj ka token / appointment\n2️⃣ Kitna time lagega (mera number)\n3️⃣ Price / jaankari\n4️⃣ Lab test / ghar se sample`,
        { buttons: ['1', '2', '3', '4'], template: 'greeting' });

    case 'BOOK_TODAY': case 'BOOK_LATER': case 'JOIN_LINE':
      return book(org, phone, lead, text, cls);

    case 'ASK_WAIT': {
      const tk = latestToken(org, phone);
      if (!tk) return WA.send(org, phone, 'Abhi aapka koi token nahi hai. Token lena hai? "token" likh dein 🙏');
      return sendStatus(org, phone, tk);
    }

    case 'ASK_PRICE': case 'ASK_INFO': case 'LAB_QUOTE': case 'OTHER': {
      const ans = groundedAnswer(org, text);
      if (ans) return WA.send(org, phone, ans, { template: 'kb_answer' });
      const l2 = S.lead(org.id, phone);
      l2.next_action = 'staff reply needed'; l2.needs_human = true; S.save();
      return WA.send(org, phone,
        `Yeh jaankari mere paas nahi hai — main clinic se poochh kar 2 minute me bata deti hoon 🙏\nTurant baat karni ho to: 📞 ${org.phone}`);
    }

    case 'RESCHEDULE': case 'CANCEL': {
      const tk = latestToken(org, phone);
      if (tk) { Q.skip(org, tk.id, 'patient'); tk.state = 'CANCELLED'; S.save(); }
      return WA.send(org, phone, 'Theek hai, aapka token hata diya gaya hai. Naya token kab chahiye?\n\n1️⃣ Aaj\n2️⃣ Kal subah\n3️⃣ Kal shaam', { buttons: ['1', '2', '3'] });
    }

    case 'REPORT_STATUS': {
      const c = S.load().collections ? null : null;
      return WA.send(org, phone, `Aapki report par kaam chal raha hai. Taiyar hote hi yahin PDF bhej denge 📄`);
    }

    case 'HUMAN':
      lead.next_action = 'staff call'; lead.needs_human = true; S.save();
      return WA.send(org, phone, `Main aapki baat clinic ki reception tak pahuncha rahi hoon — 2 minute me jawab milega 🙏\nTurant: 📞 ${org.phone}`);

    case 'EMERGENCY':
      lead.needs_human = true; lead.urgency = 'emergency'; S.save();
      WA.send(org, org.owner_phone, `🚨 EMERGENCY message from ${phone}: "${text}"`, { template: 'owner_alert' });
      return WA.send(org, phone, `Samajh gayi. Main abhi clinic ko bata rahi hoon — agar bahut takleef hai to seedha call karein: 📞 ${org.phone}\nAapko line me sabse pehle bulaya jayega.`);

    default: {
      const digit = text.trim();
      if (/^[1-4]$/.test(digit)) {
        if (digit === '1') return book(org, phone, lead, 'aaj token', {});
        if (digit === '2') { const tk = latestToken(org, phone); if (tk) return sendStatus(org, phone, tk); return WA.send(org, phone, 'Abhi aapka koi token nahi hai. "token" likh dein 🙏'); }
        if (digit === '3') { const a = groundedAnswer(org, 'price'); if (a) return WA.send(org, phone, a); }
        if (digit === '4') { lead.needs_human = true; S.save(); return WA.send(org, phone, `Main aapki baat clinic tak pahuncha rahi hoon — 2 minute me jawab milega 🙏\nTurant: 📞 ${org.phone}`); }
      }
      const ans = groundedAnswer(org, text);
      if (ans) return WA.send(org, phone, ans);
      return WA.send(org, phone,
        `Main samajh gayi 🙏 Aap kya karna chahte hain?\n\n1️⃣ Token / appointment\n2️⃣ Mera number kab\n3️⃣ Price\n4️⃣ Baat karni hai clinic se`,
        { buttons: ['1', '2', '3', '4'] });
    }
  }
}

/* ---------- booking ---------- */
function book(org, phone, lead, text, cls) {
  const provs = S.providers(org.id);
  const hint = cls.provider_name || (provs.find(p => text.toLowerCase().includes(p.name.split(' ').slice(-1)[0].toLowerCase())) || {}).name;
  const provider = Q.findProvider(org, hint);
  const svc = matchService(org, text);
  const { token, patient } = Q.issueToken(org, {
    phone, name: patient_name(org, phone), provider_id: provider ? provider.id : null,
    service_id: svc ? svc.id : null, reason: text.slice(0, 90), source: 'whatsapp'
  });
  if (lead) { lead.est_value = svc ? svc.price : (org.mode === 'salon' ? 300 : 300); lead.service_interest = svc ? svc.name : null; }
  S.save();
  return sendTokenCard(org, phone, token, { svc, firstTime: true });
}

function titleCase(x) { return String(x || '').replace(/\w\S*/g, t => t[0].toUpperCase() + t.slice(1).toLowerCase()); }
function patient_name(org, phone) { const p = S.patient(org.id, phone); return p && p.name ? p.name : null; }

function matchService(org, text) {
  const t = String(text).toLowerCase();
  return S.services(org.id).find(s => t.includes(s.name.toLowerCase())) ||
         S.services(org.id).find(s => s.name.toLowerCase().split(' ').some(w => w.length > 3 && t.includes(w)));
}

function sendTokenCard(org, phone, token, opts = {}) {
  const prov = S.load().providers.find(p => p.id === token.provider_id) || {};
  const e = ETA.etaFor(org.id, token);
  const label = Q.tokenLabel(org.id, token);
  const travel = token.travel_minutes || 20;
  const etaLine = e.isNow ? 'abhi' : ETA.windowLabel(e.startAt, e.endAt);
  const aheadTxt = e.ahead === 0 ? 'aap pehle number par hain' : `aapse pehle *${e.ahead} log* hain`;

  WA.send(org, phone,
    `✅ *Aapki baari pakki!*\n\n🎫 Token *${label}*\n👨‍⚕️ ${prov.name}${prov.room ? ' · ' + prov.room : ''}\n🕐 Anumaanit samay: *${etaLine}*\n📍 ${org.name}${org.area ? ', ' + org.area : ''}\n\n${aheadTxt}.\n🚗 Ghar se *${ymd(token.leave_by_at)}* niklein (${travel} min raasta + 10 min buffer).\n\n_Jab aap se pehle sirf 2 log bachenge, main yahin message kar dungi._`,
    { template: 'token_issued', buttons: ['📍 Location bhejein', '🔄 Badalna hai'] });

  if (opts.firstTime) {
    const p = S.patient(org.id, phone);
    if (p && !p.name && !p.profile_asked) {
      p.profile_asked = true; S.save();
      WA.send(org, phone, `Aapka naam aur area? (jaise: *Ritu, Sarabha Nagar*) — isse message me naam aayega aur nikalne ka sahi samay milega 🙏`);
      const l = S.lead(org.id, phone); if (l) { l.awaiting = 'profile'; S.save(); }
    }
  }
  return token;
}

function sendStatus(org, phone, token) {
  const prov = S.load().providers.find(p => p.id === token.provider_id) || {};
  const e = ETA.etaFor(org.id, token);
  const cur = ETA.queueOf(org.id, token.provider_id).find(t => t.state === 'CALLED' || t.state === 'IN_CONSULT');
  const label = Q.tokenLabel(org.id, token);
  if (token.state === 'CALLED') {
    return WA.send(org, phone, `🎫 *Aapki baari aa gayi!* ${label} — kripya ${prov.room || 'cabin'} mein aayein.`);
  }
  return WA.send(org, phone,
    `Aapka token *${label}* hai (${prov.name}).\n${cur ? `Abhi chal raha hai: *${Q.tokenLabel(org.id, cur)}*` : 'Doctor abhi free hain'}\n⏱ Aapki baari ${e.isNow ? '*abhi*' : '*' + ETA.windowLabel(e.startAt, e.endAt) + '*'} — ${e.ahead} log aapse pehle.`,
    { template: 'queue_position' });
}

/* ---------- grounded KB ---------- */
function groundedAnswer(org, text) {
  // tiny direct-answer shortcuts for the things patients actually type
  const t = text.toLowerCase();
  if (/^[1-4]$/.test(t.trim())) {
    const n = t.trim();
    if (n === '2') return null; // handled as status by caller; keep simple
  }
  const hits = KB.retrieve(org.id, text, 3);
  if (!hits.length) return null;
  const top = hits[0];
  if (top.score < 0.34) return null;
  const best = top.doc.text;
  // answer ONLY from the retrieved text
  const ans = best.length > 320 ? best.slice(0, 317) + '…' : best;
  if (!KB.grounded(ans, hits.map(h => h.doc))) return null;
  return ans;
}

/* ---------- lab ---------- */
function labQuote(org, phone, lead) {
  const v = AI.mockVision(org);
  const svcs = S.services(org.id);
  const tests = v.tests.map(x => ({ ...x, svc: svcs.find(s => s.name.toLowerCase() === x.test.toLowerCase()) })).filter(x => x.svc);
  const total = tests.reduce((a, x) => a + x.svc.price, 0);
  const home = org.mode === 'lab' ? 150 : 0;
  const lines = tests.map(x => `• ${x.svc.name} — ₹${x.svc.price}`).join('\n');
  const fasting = v.tests.some(x => /LFT|Lipid/i.test(x.test));

  lead.stage = 'quoted'; lead.probability = 40;
  lead.est_value = total + home; lead.service_interest = tests.map(t => t.svc.name).join(', ');
  lead.next_action = 'quote sent — follow up in 2h'; lead.next_action_at = S.addMin(new Date(), 120).toISOString();
  S.save();

  const presc = { id: S.id('rx'), org_id: org.id, patient_id: (S.patient(org.id, phone) || {}).id, vision_json: v, confidence: v.confidence, status: 'quoted', quoted_total: total, created_at: new Date().toISOString() };
  if (!S.load().prescriptions) S.load().prescriptions = [];
  S.load().prescriptions.push(presc);
  S.event(org.id, 'prescription_quoted', presc);

  return WA.send(org, phone,
    `📸 Prescription padh liya!\n\n🧪 *Aapke tests:*\n${lines}\n💵 *Total: ₹${total}*${home ? ` (+₹${home} home collection)` : ''}\n\n` +
    (fasting ? `⏳ *Fasting:* 10–12 ghante. Subah khaali pet aayein. Paani pi sakte hain.\n\n` : '') +
    `Ghar se sample chahiye?\n\n`, {
    template: 'lab_quote', buttons: ['🏠 Ghar se sample', '🏥 Lab par aaunga', '✏️ Test galat hai']
  });
}

/* ---------- staff commands from WhatsApp ---------- */
async function staffCommand(org, phone, text, cls) {
  const t = text.toLowerCase().trim();
  if (cls.intent === 'STAFF_ADD' || t === 'add' || t === '1') {
    const { token } = Q.issueToken(org, { phone: 'walkin_' + Date.now(), name: 'Walk-in', source: 'walkin' });
    return WA.send(org, org.owner_phone, `Token ${Q.tokenLabel(org.id, token)} ban gaya. ${S.providers(org.id).find(p => p.id === token.provider_id).name} ke line me.`);
  }
  if (cls.intent === 'STAFF_NEXT' || t === 'next') {
    const prov = S.providers(org.id)[0];
    const r = Q.callNext(org, prov.id, phone);
    if (r.empty) return WA.send(org, org.owner_phone, 'Line khali hai.');
    return WA.send(org, org.owner_phone, `📢 ${r.label} bulaya gaya. TV aur patient ko message chala gaya.`);
  }
  if (cls.intent === 'STAFF_DELAY') {
    const prov = S.providers(org.id)[0];
    const mins = cls.minutes || 15;
    const r = Q.delay(org, prov.id, mins, phone);
    for (const a of r.affected) {
      const p = S.load().patients.find(x => x.id === a.token.patient_id);
      if (p) WA.send(org, p.phone, `⏸ Doctor ${mins} minute late hain. Aapka naya samay: *${ymd(a.token.eta_at)}*.\n` +
        `Pareshani ke liye maaf kijiye 🙏`, { template: 'delay_notice', buttons: ['✅ Theek hai', '🔄 Reschedule'] });
    }
    return WA.send(org, org.owner_phone, `✅ ${r.affected.length} patients ko delay message chala gaya.`);
  }
  return null;
}

function latestToken(org, phone) {
  const p = S.patient(org.id, phone);
  if (!p) return null;
  return S.load().tokens.filter(t => t.org_id === org.id && t.patient_id === p.id && t.day === S.istDay()).slice(-1)[0] || null;
}

module.exports = { handle, sendTokenCard, sendStatus, labQuote, latestToken };
