'use strict';
const S = require('./store');
const KB = require('./kb');
const ETA = require('./eta');
const Q = require('./queue');

const now = new Date();
const back = (m) => S.addMin(now, -m).toISOString();

function mkOrg({ slug, name, mode, area, owner, ownerPhone, phone, staff, services, providers }) {
  const org = {
    id: S.id('org'), slug, name, mode, area, city: 'Ludhiana',
    address: area + ', Ludhiana', phone, owner_name: owner, owner_phone: ownerPhone,
    staff_phones: staff, locale: 'hi', plan: 'growth',
    wa: { lane: 'mock', status: 'connected', phone },
    hours: { mon: '10:00–14:00, 17:00–20:00', sun: 'closed' },
    settings: {
      google_review_url: 'https://g.page/r/BAARI-DEMO/review',
      two_ahead_threshold: 2, demo_mode: true, review_delay_minutes: 0, followup_scale: 1,
      maps_url: 'https://maps.google.com/?q=' + encodeURIComponent(name + ' ' + area)
    },
    created_at: new Date().toISOString()
  };
  S.load().orgs.push(org);
  providers.forEach((p, i) => S.load().providers.push({
    id: S.id('pv'), org_id: org.id, name: p.name, code: p.code, specialty: p.specialty,
    room: p.room, avg_minutes: p.avg, speed_factor: p.speed || 1, hours: { lunch: ['14:00', '17:00'] }, active: true
  }));
  services.forEach(s => S.load().services.push({
    id: S.id('sv'), org_id: org.id, name: s.name, price: s.price, duration_min: s.dur, active: true
  }));
  KB.seed(org);
  return org;
}

function run() {
  const d = S.load();
  if (d.orgs.length) { console.log('already seeded — run npm run reset to rebuild'); return; }

  /* ───────────────────────── 🩺 CLINIC (fully demoed) ───────────────────────── */
  const clinic = mkOrg({
    slug: 'dr-sharma', name: 'Dr Sharma Dental', mode: 'clinic', area: 'Model Town',
    owner: 'Dr. Rajesh Sharma', ownerPhone: '919999900001', phone: '0161-4000123',
    staff: ['919999900002'],
    providers: [
      { name: 'Dr. Rajesh Sharma', code: 'S', specialty: 'Dental surgeon · RCT, implants', room: 'Cabin 1', avg: 12 },
      { name: 'Dr. Simran Kaur', code: 'K', specialty: 'General & children', room: 'Cabin 2', avg: 8 },
      { name: 'Dr. Aman Verma', code: 'V', specialty: 'Ortho consult', room: 'Cabin 3', avg: 15 }
    ],
    services: [
      { name: 'Consultation', price: 300, dur: 10 },
      { name: 'Scaling', price: 1200, dur: 30 },
      { name: 'Root Canal (RCT)', price: 4500, dur: 45 },
      { name: 'Extraction', price: 800, dur: 20 },
      { name: 'Braces', price: 35000, dur: 40 },
      { name: 'Child checkup', price: 250, dur: 10 }
    ]
  });

  /* seeded history: 12 completed tokens so the ETA engine has learned something */
  const pv = S.providers(clinic.id);
  const ppl = [
    ['Gurpreet Singh', '919810000001'], ['Ritu Sharma', '919810000002'], ['Harpreet Kaur', '919810000003'],
    ['Mohit Arora', '919810000004'], ['Simran Bedi', '919810000005'], ['Amanjot Gill', '919810000006'],
    ['Neha Gupta', '919810000007'], ['Vikram Singh', '919810000008'], ['Jaspreet Kaur', '919810000009'],
    ['Rahul Verma', '919810000010'], ['Priya Nanda', '919810000011'], ['Karan Sethi', '919810000012']
  ];
  ppl.forEach(([name, phone], i) => {
    S.load().patients.push({ id: S.id('pt'), org_id: clinic.id, phone, name, locale: 'hi', consent: { wa: true, marketing: false }, visits: 1, blocked: false, last_visit_at: back(30 + i * 3) });
    S.load().leads.push({
      id: S.id('ld'), org_id: clinic.id, phone, name, source: ['wa_inbound', 'walkin', 'web'][i % 3],
      first_message: ['daant me dard hai', 'cleaning karwani hai', 'braces ka kitna', 'checkup'][i % 4],
      intent: 'book_now', stage: i < 4 ? 'visited' : i < 7 ? 'booked' : i < 10 ? 'quoted' : 'enquiry',
      est_value: [300, 1200, 4500, 800, 35000][i % 5], probability: i < 4 ? 100 : i < 7 ? 90 : 40,
      next_action: 'follow up', next_action_at: S.addMin(now, 60 + i * 10).toISOString(),
      last_inbound_at: back(20 + i * 37), do_not_contact: false, created_at: back(60 + i * 40), followups_sent: 0
    });
  });

  /* completed tokens (feed EWMA: Dr Sharma really takes ~14, Kaur ~7, Verma ~22) */
  const done = [
    [0, 0, 14], [1, 1, 7], [2, 2, 22], [3, 0, 14], [4, 1, 7], [5, 0, 15],
    [6, 2, 21], [7, 1, 8], [8, 0, 13], [9, 1, 7], [10, 0, 14], [11, 2, 23]
  ];
  let base = 60 * 6;
  done.forEach(([pi, pvi, actual]) => {
    const startedAt = back(base); base -= actual + 6;
    const t = {
      id: S.id('tk'), org_id: clinic.id, patient_id: d.patients[pi].id, provider_id: pv[pvi].id,
      day: S.istDay(), number: 0, state: 'DONE', source: 'walkin', reason: 'history',
      priority: 100, checked_in_at: S.addMin(startedAt, -8).toISOString(),
      called_at: startedAt, done_at: S.addMin(startedAt, actual).toISOString(),
      alerts_sent: {}, created_at: S.addMin(startedAt, -14).toISOString()
    };
    d.tokens.push(t);
    ETA.learn(clinic.id, t);
  });
  // renumber the historic tokens per provider
  for (const p of pv) {
    d.tokens.filter(t => t.provider_id === p.id).sort((a, b) => new Date(a.called_at) - new Date(b.called_at))
      .forEach((t, i) => { t.number = i + 1; });
  }
  d.tokens.filter(t => t.org_id === clinic.id).forEach(t => { t.day = S.istDay(); });

  /* 3 patients waiting right now + 1 booked for later */
  const waiting = [
    ['Sandeep Kaur', '919810000021', pv[0].id, 'tooth pain', 'ARRIVED', 0],
    ['Anil Kapoor', '919810000022', pv[1].id, 'cleaning', 'ARRIVED', 1],
    ['Manpreet Singh', '919810000023', pv[2].id, 'braces check', 'ARRIVED', 3]
  ];
  waiting.forEach(([name, phone, providerId, reason, state, priority], i) => {
    S.load().patients.push({ id: S.id('pt'), org_id: clinic.id, phone, name, locale: 'hi', consent: { wa: true, marketing: false }, visits: 0, blocked: false });
    S.load().leads.push({
      id: S.id('ld'), org_id: clinic.id, phone, name, source: 'whatsapp', first_message: reason,
      intent: 'book_now', stage: 'booked', est_value: 300, probability: 90,
      next_action: 'confirm slot', next_action_at: null, last_inbound_at: back(25), do_not_contact: false,
      created_at: back(30), followups_sent: 0
    });
    const num = Math.max(...d.tokens.filter(t => t.provider_id === providerId).map(t => t.number), 0) + 1;
    d.tokens.push({
      id: S.id('tk'), org_id: clinic.id, patient_id: S.load().patients.slice(-1)[0].id, provider_id: providerId,
      day: S.istDay(), number: num, state, source: 'whatsapp', reason, service_id: null,
      priority, checked_in_at: back(10 + i * 3), travel_minutes: 18,
      alerts_sent: {}, created_at: back(12 + i * 3)
    });
  });

  // one 2★ private feedback to show the early-warning alert
  S.load().feedback.push({ id: S.id('fb'), org_id: clinic.id, patient_id: d.patients[2].id, token_id: null, rating: 2, comment: '"waiting bahut lambi thi"', created_at: back(120) });

  /* ───────────────────────── 🧪 LAB ───────────────────────── */
  mkOrg({
    slug: 'nova-lab', name: 'Nova Diagnostics', mode: 'lab', area: 'Sarabha Nagar',
    owner: 'Nitin Sood', ownerPhone: '919999900003', phone: '0161-4000999', staff: ['919999900004'],
    providers: [{ name: 'Sunita (Phlebotomist)', code: 'P', specialty: 'Home collection', room: 'Route 1', avg: 10 }],
    services: [
      { name: 'CBC', price: 250, dur: 5 }, { name: 'LFT', price: 600, dur: 5 }, { name: 'KFT', price: 600, dur: 5 },
      { name: 'HbA1c', price: 450, dur: 5 }, { name: 'TSH', price: 250, dur: 5 }, { name: 'Lipid profile', price: 500, dur: 5 },
      { name: 'Vitamin D', price: 1200, dur: 5 }
    ]
  });

  /* ───────────────────────── ✂️ SALON ───────────────────────── */
  mkOrg({
    slug: 'glam', name: 'Glam Studio', mode: 'salon', area: 'Sarabha Nagar',
    owner: 'Ritu Mehra', ownerPhone: '919999900005', phone: '0161-4000777', staff: ['919999900006'],
    providers: [
      { name: 'Ritu', code: 'R', specialty: 'Senior stylist · layers, balayage', room: 'Chair 1', avg: 45 },
      { name: 'Aman', code: 'A', specialty: 'Barber · fades, beard', room: 'Chair 2', avg: 25 }
    ],
    services: [
      { name: 'Haircut', price: 300, dur: 30 }, { name: 'Beard trim', price: 150, dur: 15 },
      { name: 'Hair colour', price: 1500, dur: 60 }, { name: 'Facial', price: 1200, dur: 45 },
      { name: 'Bridal package', price: 8000, dur: 180 }
    ]
  });

  Q.recalc(clinic);
  S.saveNow();
  console.log('seeded: 3 tenants · clinic has 12 completed tokens + 3 waiting');
  console.log('open http://localhost:3000');
}

run();
module.exports = { run };
