'use strict';
/* Single source of truth for packaging (docs/09 §2, docs/10 §B4) */
const PLANS = {
  pilot:   { name: 'Pilot',   activation: 1000,  monthly: 0,     annual: 0,     providers: 2,  tokens: 200,   tv: 1,  lab: false, campaigns: 0 },
  starter: { name: 'Starter', activation: 2999,  monthly: 999,   annual: 9999,  providers: 1,  tokens: 500,   tv: 1,  lab: false, campaigns: 0 },
  growth:  { name: 'Growth',  activation: 4999,  monthly: 1999,  annual: 19999, providers: 4,  tokens: 2500,  tv: 2,  lab: false, campaigns: 500 },
  pro:     { name: 'Pro',     activation: 9999,  monthly: 3999,  annual: 39999, providers: 99, tokens: 10000, tv: 5,  lab: true,  campaigns: 2500 },
  hospital:{ name: 'Hospital',activation: 19999, monthly: 8999,  annual: 89999, providers: 99, tokens: 1e9,   tv: 10, lab: true,  campaigns: 10000 }
};
const ADDONS = {
  tv_screen:      { name: 'Extra TV screen', setup: 999,  monthly: 299 },
  wa_number:      { name: 'Extra WhatsApp number', setup: 4999, monthly: 799 },
  lab_module:     { name: 'Lab module',      setup: 9999, monthly: 1499 },
  meta_lane:      { name: 'Official Meta API lane', setup: 4999, monthly: 0, note: 'Meta message charges passed through' },
  extra_branch:   { name: 'Extra branch',    setup: 9999, monthly: 999 }
};
const GST = 0.18;
const inr = n => Math.round(Number(n || 0));
const inrStr = n => inr(n).toLocaleString('en-IN');
const withGst = n => ({ base: inr(n), gst: inr(n * GST), total: inr(n * (1 + GST)) });

function quote(planKey, { period = 'monthly', addons = [] } = {}) {
  const p = PLANS[planKey] || PLANS.growth;
  const setupBase = p.activation + addons.reduce((a, k) => a + (ADDONS[k]?.setup || 0), 0);
  const recurBase = (period === 'annual' ? p.annual : p.monthly) + addons.reduce((a, k) => a + (ADDONS[k]?.monthly || 0) * (period === 'annual' ? 12 : 1), 0);
  return {
    plan: planKey, period,
    setup: withGst(setupBase),
    recurring: withGst(recurBase),
    headline: period === 'annual'
      ? `₹${inrStr(recurBase * (1 + GST))} poora saal, activation free`
      : `₹${inrStr(setupBase * (1 + GST))} activation + ₹${inrStr(recurBase * (1 + GST))}/month`,
    note: period === 'annual' ? 'Activation waived on annual prepay' : '60% advance, 40% on go-live'
  };
}

module.exports = { PLANS, ADDONS, quote, withGst, GST, inr, inrStr };
