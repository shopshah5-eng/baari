const SLUG = new URLSearchParams(location.search).get('t') || 'dr-sharma';
async function api(p, opt) {
  const r = await fetch('/api/' + SLUG + p, opt ? { headers: { 'content-type': 'application/json' }, ...opt, body: opt.body ? JSON.stringify(opt.body) : undefined } : undefined);
  return r.json();
}
function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2600);
}
const t12 = iso => iso ? new Date(iso).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', '') : '—';
const nav = (cur) => `<div class="topbar"><div class="wrap">
  <div class="brand"><span class="dot">#</span> baari</div>
  <span class="mode-chip">${location.pathname.includes('tv') ? 'TV Display' : 'Dr Sharma Dental'}</span>
  <div class="spacer"></div>
  <div class="nav">
    <a href="/desk?t=${SLUG}" class="${cur === 'desk' ? 'on' : ''}">Desk</a>
    <a href="/cabin?t=${SLUG}" class="${cur === 'cabin' ? 'on' : ''}">Cabin</a>
    <a href="/leads?t=${SLUG}" class="${cur === 'leads' ? 'on' : ''}">Leads</a>
    <a href="/app?t=${SLUG}" class="${cur === 'app' ? 'on' : ''}">Owner</a>
    <a href="/bot?t=${SLUG}" class="${cur === 'bot' ? 'on' : ''}">WhatsApp</a>
    <a href="/lab?t=${SLUG}" class="${cur === 'lab' ? 'on' : ''}">Lab</a>
    <a href="/billing?t=${SLUG}" class="${cur === 'billing' ? 'on' : ''}">Billing</a>
    <a href="/tv?t=${SLUG}" class="${cur === 'tv' ? 'on' : ''}">TV</a>
  </div></div></div>`;
