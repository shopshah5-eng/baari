'use strict';
/* Review engine — NO Google API needed for the ask (link only).
   Compliant by design: the Google link is offered to EVERY rating, and a private
   channel is offered to every rating. See docs/10 §A4 */
const S = require('./store');
const WA = require('./wa');

function eligible(org, patientId, tokenId) {
  const asks = S.load().review_asks.filter(a => a.org_id === org.id && a.patient_id === patientId);
  if (asks.some(a => a.token_id === tokenId)) return 'already_asked_this_visit';
  const recent = asks.filter(a => S.minsBetween(a.asked_at, new Date()) < 180 * 1440);
  if (recent.length >= 2) return 'max_2_per_6_months';
  if (recent.some(a => a.clicked_at && S.minsBetween(a.clicked_at, new Date()) < 90 * 1440)) return 'engaged_recently';
  const low = S.load().feedback.find(f => f.org_id === org.id && f.patient_id === patientId && f.rating <= 3);
  if (low) return 'known_unhappy';
  const p = S.load().patients.find(x => x.id === patientId);
  if (!p || p.blocked || !(p.consent && p.consent.wa)) return 'no_consent';
  return null;
}

function askReview(org, token) {
  const p = S.load().patients.find(x => x.id === token.patient_id);
  if (!p) return { skipped: 'no_patient' };
  const reason = eligible(org, p.id, token.id);
  if (reason) return { skipped: reason };
  S.load().review_asks.push({ id: S.id('ra'), org_id: org.id, patient_id: p.id, token_id: token.id, asked_at: new Date().toISOString(), channel: 'whatsapp' });
  const lead = S.lead(org.id, p.phone);
  if (lead) lead.awaiting_rating = token.id;
  S.save();
  WA.send(org, p.phone,
    `🙏 ${org.name} — aaj aane ke liye dhanyavaad!\n\nAapka experience kaisa raha? (1 se 5 — bas number likh dein)`,
    { template: 'review_ask', buttons: ['1', '2', '3', '4', '5'] });
  return { asked: true };
}

function recordRating(org, phone, rating, tokenId) {
  const p = S.patient(org.id, phone);
  if (!p) return null;
  const fb = { id: S.id('fb'), org_id: org.id, patient_id: p.id, token_id: tokenId || null, rating, comment: null, created_at: new Date().toISOString() };
  S.load().feedback.push(fb);
  const ask = S.load().review_asks.reverse().find(a => a.org_id === org.id && a.patient_id === p.id);
  if (ask) ask.feedback_rating = rating;
  const lead = S.lead(org.id, phone);
  if (lead) { delete lead.awaiting_rating; S.save(); }

  const link = (org.settings && org.settings.google_review_url) || '#';
  // the Google link goes to EVERYONE — that is what keeps it inside Google's policy
  WA.send(org, phone,
    `Dhanyavaad! 🙏 Do chhoti cheezein:\n\n⭐ Agar achha laga, Google pe 30 second me likh dein — clinic ko bahut farak padta hai:\n${link}\n\n✍️ Kuch theek nahi laga? Seedha ${org.owner_name || 'doctor'} ko bataein (yeh public nahi hoga) — bas likh dein.`,
    { template: 'review_link' });

  if (rating <= 3) {
    const owner = org.owner_phone;
    WA.send(org, owner, `⚠️ ${rating}★ private feedback — ${p.name || p.phone}\n"${fb.comment || '(no comment yet)'}"\nYeh Google pe PUBLIC nahi jayega. Call kar lein.`, { template: 'owner_alert', kind: 'transactional' });
  }
  return fb;
}

module.exports = { askReview, recordRating, eligible };
