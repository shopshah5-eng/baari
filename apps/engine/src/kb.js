'use strict';
/* Knowledge base + grounded answering. See docs/07 §5
   Rule: a wrong "I don't know" costs nothing. A wrong price costs the customer.
   So the threshold is deliberately aggressive towards escalation. */
const S = require('./store');

function add(orgId, { source, title, text }) {
  const doc = { id: S.id('kb'), org_id: orgId, source, title, text, indexed_at: new Date().toISOString() };
  S.load().kb_docs.push(doc); S.save(); return doc;
}

function docs(orgId) { return S.load().kb_docs.filter(d => d.org_id === orgId); }

const STOP = new Set(['ka', 'ki', 'ke', 'hai', 'hain', 'kya', 'kitna', 'kitne', 'the', 'is', 'a', 'of', 'me', 'mein', 'and', 'for', 'to', 'kya', 'ko', 'se', 'ho', 'kar', 'la', 'do']);
const tok = s => String(s || '').toLowerCase().replace(/[^\w\u0900-\u097F\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));

/* BM25-lite: exact token overlap + price/name boost. Swap for pgvector later. */
function retrieve(orgId, query, k = 5) {
  const q = tok(query);
  if (!q.length) return [];
  const scored = docs(orgId).map(d => {
    const body = tok(d.title + ' ' + d.text);
    const set = new Set(body);
    let score = 0;
    for (const w of q) {
      if (set.has(w)) score += 1;
      else if (body.some(b => b.startsWith(w) && w.length > 3)) score += 0.5;
    }
    return { doc: d, score: score / Math.max(1, q.length) };
  }).sort((a, b) => b.score - a.score);
  return scored.filter(s => s.score > 0).slice(0, k);
}

/* is every ₹ amount / number in the answer present in the source? */
function grounded(answer, sources) {
  const nums = (String(answer).match(/\d[\d,]*/g) || []).map(s => s.replace(/,/g, ''));
  const pool = sources.map(s => s.text + ' ' + s.title).join(' ');
  return nums.every(n => pool.replace(/,/g, '').includes(n));
}

const SEED_KB = {
  clinic: [
    ['Services & Prices', 'Consultation Rs 300. Scaling Rs 1200. Root canal (RCT) Rs 4500. Extraction Rs 800. Braces Rs 35000. Teeth whitening Rs 6000. Child checkup Rs 250.'],
    ['Timings', 'Dr Sharma Dental is open Monday to Saturday 10:00 AM to 2:00 PM and 5:00 PM to 8:00 PM. Sunday closed. Lunch break 2 PM to 5 PM.'],
    ['Doctors', 'Dr Rajesh Sharma - BDS MDS, dental surgeon, 18 years experience, does RCT and implants. Dr Simran Kaur - BDS, general dentistry and children, 6 years experience. Language: Hindi, Punjabi, English.'],
    ['Location & Parking', 'Model Town market, near Bus Stand, Ludhiana. Free parking in front of clinic. Wheelchair accessible.'],
    ['Root canal info', 'Root canal takes 2 to 3 sittings of 45 minutes each. Local anaesthesia is used, it is painless. Patient can eat after 2 hours. No rest needed.'],
    ['Payment', 'Cash, UPI, card accepted. EMI available on braces above Rs 20000.']
  ],
  lab: [
    ['Test Prices', 'CBC Rs 250. LFT Rs 600. KFT Rs 600. HbA1c Rs 450. TSH Rs 250. Lipid profile Rs 500. Vitamin D Rs 1200. Home collection charge Rs 150.'],
    ['Fasting rules', 'Lipid profile and LFT need 10 to 12 hours fasting. CBC, TSH and HbA1c do not need fasting. Water is allowed during fasting.'],
    ['Home collection', 'Home collection available 7 AM to 9 AM, Monday to Saturday. Booking must be done one day before. Phlebotomist carries sterile single-use kit.'],
    ['Report time', 'Most reports are ready within 24 hours. Vitamin D takes 48 hours. Report is sent on WhatsApp as PDF.']
  ],
  salon: [
    ['Services & Prices', 'Haircut Rs 300. Beard trim Rs 150. Hair colour Rs 1500. Facial Rs 1200. Waxing full arms Rs 800. Bridal package Rs 8000. Keratin Rs 4500.'],
    ['Timings', 'Open Tuesday to Sunday 11 AM to 9 PM. Monday closed.'],
    ['Stylists', 'Ritu - senior stylist, 10 years, known for layers and balayage. Aman - barber, 6 years, fades and beard styling.'],
    ['Bridal', 'Bridal package Rs 8000 includes makeup, hair styling and draping. Takes 3 hours. Trial Rs 2000, adjusted in final booking. Book at least 7 days in advance.']
  ]
};

function seed(org) {
  if (docs(org.id).length) return;
  for (const [title, text] of (SEED_KB[org.mode] || [])) add(org.id, { source: 'setup', title, text });
}

/* simulated website crawl — in production: fetch + readability + chunk */
function ingestUrl(orgId, url) {
  const host = String(url).replace(/^https?:\/\//, '').split('/')[0];
  const chunks = [
    ['Website: About', `Welcome to our ${host} clinic page. We are a family dental and skin care centre serving patients since 2011 with modern equipment and sterilised instruments.`],
    ['Website: FAQ', 'Do you take walk-ins? Yes, walk-ins are welcome but appointment patients are seen first. Is there an emergency number? Yes, call the clinic number for dental emergencies.']
  ];
  return chunks.map(([t, x]) => add(orgId, { source: 'website:' + host, title: t, text: x }));
}

function ask(orgId, query) {
  const hits = retrieve(orgId, query);
  if (!hits.length || hits[0].score < 0.35) {
    return { escalate: true, answer: null };
  }
  const best = hits[0].doc;
  return { escalate: false, answer: best.text, title: best.title, score: hits[0].score };
}

module.exports = { add, docs, retrieve, grounded, seed, ingestUrl, ask };
