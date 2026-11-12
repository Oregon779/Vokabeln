const OV39 = { range: 14, sess: [], prof: [], reqs: [], cap: null, counted: false, seen: null, chart: null };
function berlinKey39(d){ return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(d); }
function greet39(){
  const h = Number(new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: 'numeric', hour12: false }).format(new Date()));
  return h < 5 ? 'Bonne nuit' : h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
}
const REDUCED39 = matchMedia('(prefers-reduced-motion: reduce)').matches;
async function loadOverview39(){
  if(!sb) return;
  const since = new Date(Date.now() - 62 * DAY39).toISOString();
  const [s, p, r, c] = await Promise.all([
    sb.from('active_sessions').select('id, user_id, display_label, device_label, created_at, last_seen').gte('created_at', since).order('created_at', { ascending: true }).limit(8000),
    sb.from('profiles').select('user_id, email, display_name, created_at, plan, plan_until, banned, banned_until, is_admin, photo_status, photo_updated_at, avatar_kind, avatar_config, photo_path, avatar_locked, photo_locked').order('created_at', { ascending: false }),
    sb.from('upgrade_requests').select('id, user_id, display_name, email, plan, kind, status, price_cents, decided_at, created_at').order('created_at', { ascending: false }).limit(1000),
    sb.rpc('get_capacity'),
  ]);
  OV39.sess = s.data || []; OV39.prof = p.data || []; OV39.reqs = r.data || []; OV39.cap = c.data || null;
  renderOverview39();
}
// Tageswerte (Berlin) fuer die letzten n Tage, endet heute
function days39(n, offset){
  const out = [], now = Date.now() - (offset || 0) * DAY39;
  for(let i = n - 1; i >= 0; i--){ const d = new Date(now - i * DAY39); out.push({ k: berlinKey39(d), d, v: 0, u: new Set(), reg: 0, up: 0, rq: 0, eur: 0 }); }
  return out;
}
function fillDays39(days){
  const by = new Map(days.map(x => [x.k, x]));
  const at = (iso) => iso ? by.get(berlinKey39(new Date(iso))) : null;
  OV39.sess.forEach(x => { const d = at(x.created_at); if(d){ d.v++; if(x.user_id) d.u.add(x.user_id); } });
  OV39.prof.forEach(x => { const d = at(x.created_at); if(d) d.reg++; const e = at(x.photo_updated_at); if(e) e.up++; });
  OV39.reqs.forEach(x => { const d = at(x.created_at); if(d) d.rq++; if(x.status === 'erledigt' && x.price_cents){ const e = at(x.decided_at); if(e) e.eur += x.price_cents; } });
  return days;
}
// Trend als kleine Pille: Vergleich mit dem Zeitraum davor
function trend39(cur, prev, kind){
  if(kind === 'wait') return cur > 0 ? '<span class="g39-chip warn">wartet</span>' : '<span class="g39-chip ok">erledigt</span>';
  if(kind === 'share') return `<span class="g39-chip">${cur} %</span>`;
  if(!prev && !cur) return '<span class="g39-chip">±0</span>';
  if(!prev) return '<span class="g39-chip up">neu</span>';
  const pct = Math.round((cur - prev) / prev * 100);
  if(pct === 0) return '<span class="g39-chip">±0 %</span>';
  return `<span class="g39-chip ${pct > 0 ? 'up' : 'down'}">${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)} %</span>`;
}
// Mini-Verlauf: Flaeche + Linie, Endpunkt betont
function spark39(svg, vals, tone){
  if(!svg) return;
  const W = 120, H = 32, max = Math.max(1, ...vals), n = vals.length;
  const pts = vals.map((v, i) => [n === 1 ? W : i / (n - 1) * W, H - 3 - v / max * (H - 8)]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
  const id = 'sg' + Math.random().toString(36).slice(2, 7);
  const last = pts[pts.length - 1];
  svg.innerHTML = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".32"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>`
    + `<path d="${line}L${W} ${H}L0 ${H}Z" fill="url(#${id})"/><path d="${line}" fill="none" stroke="currentColor" stroke-width="1.4" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>`
    + `<circle cx="${last[0]}" cy="${last[1]}" r="2.2" fill="currentColor"/>`;
  svg.setAttribute('data-tone', tone || '');
}
// Zahlen zaehlen beim ersten Oeffnen hoch
function countUp39(el, to, fmt){
  if(!el) return;
  fmt = fmt || ((v) => String(Math.round(v)));
  if(OV39.counted || REDUCED39 || !isFinite(to)){ el.textContent = fmt(to); return; }
  const t0 = performance.now(), dur = 900;
  const step = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(to * e); if(k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
const EUR39 = (c) => (c / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
function renderOverview39(){
  const now = new Date();
  const name = currentProfile && (currentProfile.display_name || (currentUser.email || '').split('@')[0]);
  $a('a39Greet').innerHTML = escapeHtml(greet39()) + ', <em>' + escapeHtml(name || 'Admin') + '</em>';
  $a('a39Date').textContent = now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' });
  // Diagramm
  const n = OV39.range, days = fillDays39(days39(n));
  drawChart39(days);
  const sum = days.reduce((a, x) => a + x.v, 0), regs = days.reduce((a, x) => a + x.reg, 0);
  const uniq = new Set(); days.forEach(x => x.u.forEach(u => uniq.add(u)));
  $a('a39BarsSum').textContent = sum;
  $a('a39BarsAvg').textContent = (sum / n).toFixed(1).replace('.', ',');
  $a('a39BarsUsers').textContent = uniq.size;
  $a('a39BarsReg').textContent = regs;
  // KI-Kontingent
  const cap = OV39.cap || { used: 0, total: (siteSettings && siteSettings.ai_capacity_total) || 0 };
  const pct = cap.total ? Math.min(1, cap.used / cap.total) : 0;
  const fg = $a('a39RingFg');
  requestAnimationFrame(() => fg.setAttribute('stroke-dashoffset', (364.4 * (1 - pct)).toFixed(1)));
  fg.classList.toggle('hot', pct > .85);
  countUp39($a('a39RingPct'), pct * 100, (v) => Math.round(v) + ' %');
  $a('a39CapUsed').textContent = cap.used;
  $a('a39CapFree').textContent = Math.max(0, cap.total - cap.used);
  $a('a39CapTotal').textContent = cap.total;
  $a('a39CapLimit').textContent = siteSettings ? siteSettings.ai_daily_limit : '–';
  // Kennzahlen: 14 Tage fuer die Mini-Verlaeufe, 7 gegen 7 fuer den Trend
  const d14 = fillDays39(days39(14)), wk = d14.slice(7), pw = d14.slice(0, 7);
  const s = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
  const uniqOf = (arr) => { const u = new Set(); arr.forEach(x => x.u.forEach(v => u.add(v))); return u.size; };
  const tile = (k) => document.querySelector(`.g39-kpi[data-kpi="${k}"]`);
  const set = (k, vals, tr, tone) => { const t = tile(k); if(!t) return; spark39(t.querySelector('.g39-spark'), vals, tone); t.querySelector('[data-trend]').innerHTML = tr; };
  const total = OV39.prof.length;
  let cum = total - s(d14, x => x.reg);
  set('users', d14.map(x => (cum += x.reg)), trend39(s(wk, x => x.reg), s(pw, x => x.reg)), 'gold');
  set('online', d14.map(x => x.v), trend39(s(wk, x => x.v), s(pw, x => x.v)), 'ok');
  set('new', d14.map(x => x.reg), trend39(s(wk, x => x.reg), s(pw, x => x.reg)), 'gold');
  set('active', d14.map(x => x.u.size), trend39(uniqOf(wk), uniqOf(pw)), 'ivory');
  const open = OV39.reqs.filter(x => x.status === 'offen').length;
  const photos = OV39.prof.filter(x => x.photo_status === 'pending').length;
  set('open', d14.map(x => x.rq), trend39(open, 0, 'wait'), 'warn');
  set('photos', d14.map(x => x.up), trend39(photos, 0, 'wait'), 'warn');
  const mon = (dt) => OV39.reqs.filter(x => x.status === 'erledigt' && x.price_cents && x.decided_at && new Date(x.decided_at).getMonth() === dt.getMonth() && new Date(x.decided_at).getFullYear() === dt.getFullYear()).reduce((a, x) => a + x.price_cents, 0);
  const month = mon(now), prevMonth = mon(new Date(now.getFullYear(), now.getMonth() - 1, 15));
  set('money', d14.map(x => x.eur), trend39(month, prevMonth), 'gold');
  const banned = OV39.prof.filter(x => banRunning(x)).length;
  set('banned', d14.map(() => banned), trend39(total ? Math.round(banned / total * 100) : 0, 0, 'share'), 'bad');
  countUp39($a('a39KpiNew'), s(wk, x => x.reg));
  countUp39($a('a39KpiActive'), uniqOf(wk));
  countUp39($a('a39KpiOpen'), open);
  countUp39($a('a39KpiPhotos'), photos);
  countUp39($a('a39KpiMoney'), month, EUR39);
  ['adminStatUsers', 'adminStatOnline', 'adminStatBanned'].forEach(id => { const el = $a(id), v = parseInt(el.textContent, 10); if(!isNaN(v)) countUp39(el, v); });
  // Zustand oben
  const live = siteSettings && typeof siteSettings.live_build === 'number' ? siteSettings.live_build : 0;
  const onlineNow = OV39.sess.filter(x => now - new Date(x.last_seen) < 5 * 60000).length;
  const mt = !!(siteSettings && siteSettings.maintenance_mode);
  $a('g39Status').innerHTML = `<span class="g39-chip ok"><i class="g39-dot"></i>${onlineNow} online</span>`
    + `<span class="g39-chip ${mt ? 'warn' : ''}">${mt ? 'Wartung läuft' : 'Website läuft'}</span>`
    + (live < APP_VERSION ? `<span class="g39-chip gold">Build ${APP_VERSION} wartet auf Freigabe</span>` : `<span class="g39-chip">Build ${live} öffentlich</span>`);
  // Zu erledigen
  const todo = [];
  if(photos) todo.push({ n: photos, hot: true, t: 'Profilfotos prüfen', s: 'Warten auf Freigabe', go: 'photos' });
  if(open) todo.push({ n: open, hot: true, t: 'Tarif-Anfragen', s: 'Offen in „Anfragen & Abos“', go: 'abos' });
  if(live < APP_VERSION) todo.push({ n: '!', hot: true, t: `Build ${APP_VERSION} freigeben`, s: `Öffentlich ist Build ${live}`, go: 'version' });
  if(mt) todo.push({ n: '⏸', hot: false, t: 'Wartung läuft', s: 'Normale Nutzer sehen den Wartungs-Bildschirm', go: 'maintenance' });
  const chev = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>';
  $a('a39Todo').innerHTML = todo.length ? todo.map(x => `<button type="button" class="a39-todo" data-go39="${x.go}"><i class="n${x.hot ? ' hot' : ''}">${x.n}</i><span>${escapeHtml(x.t)}<small>${escapeHtml(x.s)}</small></span>${chev}</button>`).join('')
    : '<div class="g39-done"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.6 2.6L16 9.5"/></svg><p>Nichts offen.<br><small>Alles erledigt.</small></p></div>';
  renderFeed39();
  OV39.counted = true;
}

// ---- Live-Aktivitaet: neue Konten, online, Anfragen, Freigaben, Fotos ----
function ago39(iso){
  const d = new Date(iso), s = (Date.now() - d) / 1000;
  if(s < 60) return 'gerade eben';
  if(s < 3600) return 'vor ' + Math.round(s / 60) + ' Min.';
  if(s < 6 * 3600) return 'vor ' + Math.round(s / 3600) + ' Std.';
  const t = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
  if(berlinKey39(d) === berlinKey39(new Date())) return 'heute ' + t;
  if(berlinKey39(d) === berlinKey39(new Date(Date.now() - DAY39))) return 'gestern ' + t;
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', timeZone: 'Europe/Berlin' });
}
const FEED_IC39 = {
  join: '<path d="M15 19a6 6 0 0 0-12 0M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19 8v6M16 11h6"/>',
  online: '<path d="M5 12.5a9 9 0 0 1 14 0M8.5 15.5a4.5 4.5 0 0 1 7 0M12 19h.01"/>',
  ask: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>',
  ok: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.6 2.6L16 9.5"/>',
  no: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
  photo: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
};
function renderFeed39(){
  const list = $a('g39Feed');
  if(!list) return;
  const nm = (x) => escapeHtml(x.display_name || (x.email || '').split('@')[0] || 'Jemand');
  const plan = (k) => k === 'pro' ? 'Pro' : 'Plus';
  const ev = [];
  OV39.prof.forEach(p => {
    ev.push({ t: p.created_at, k: 'join', h: `<b>${nm(p)}</b> hat ein Konto angelegt`, key: 'j' + p.user_id });
    if(p.photo_status === 'pending' && p.photo_updated_at) ev.push({ t: p.photo_updated_at, k: 'photo', h: `<b>${nm(p)}</b> hat ein Profilfoto hochgeladen`, key: 'p' + p.user_id + p.photo_updated_at, go: 'photos' });
  });
  const dayAgo = Date.now() - DAY39;
  OV39.sess.forEach(x => { if(new Date(x.created_at) > dayAgo && x.user_id) ev.push({ t: x.created_at, k: 'online', h: `<b>${escapeHtml(x.display_label || 'Jemand')}</b> ist online <span>· ${escapeHtml(x.device_label || '')}</span>`, key: 's' + x.id }); });
  OV39.reqs.forEach(r => {
    if((r.kind || 'anfrage') === 'anfrage') ev.push({ t: r.created_at, k: 'ask', h: `<b>${nm(r)}</b> fragt ${plan(r.plan)} an`, key: 'r' + r.id, go: 'abos' });
    if(r.decided_at && r.status === 'erledigt') ev.push({ t: r.decided_at, k: 'ok', h: `${plan(r.plan)} für <b>${nm(r)}</b> freigeschaltet${r.price_cents ? ` <span>· ${EUR39(r.price_cents)}</span>` : ''}`, key: 'd' + r.id });
    if(r.decided_at && r.status === 'abgelehnt') ev.push({ t: r.decided_at, k: 'no', h: `Anfrage von <b>${nm(r)}</b> abgelehnt`, key: 'x' + r.id });
  });
  ev.sort((a, b) => new Date(b.t) - new Date(a.t));
  const top = ev.slice(0, 9);
  const first = !OV39.seen;
  OV39.seen = OV39.seen || new Set();
  list.innerHTML = top.length ? top.map((e, i) => {
    const fresh = !first && !OV39.seen.has(e.key);
    return `<li class="g39-ev k-${e.k}${fresh ? ' fresh' : ''}"${e.go ? ` data-go39="${e.go}"` : ''} style="--i:${i}"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${FEED_IC39[e.k]}</svg></span><p>${e.h}</p><time datetime="${e.t}">${ago39(e.t)}</time></li>`;
  }).join('') : '<li class="a39-empty">Noch nichts passiert.</li>';
  top.forEach(e => OV39.seen.add(e.key));
}

// ---- Flaechendiagramm (SVG, in echten Pixeln fuer scharfe Schrift) ----
function mono39(pts){
  // monotone kubische Kurve (Fritsch-Carlson): kein Ueberschwingen unter null
  const n = pts.length;
  if(n < 2) return pts.length ? `M${pts[0][0]} ${pts[0][1]}` : '';
  const dx = [], dy = [], m = [], t = [];
  for(let i = 0; i < n - 1; i++){ dx[i] = pts[i + 1][0] - pts[i][0]; dy[i] = pts[i + 1][1] - pts[i][1]; m[i] = dy[i] / dx[i]; }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for(let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for(let i = 0; i < n - 1; i++){
    if(m[i] === 0){ t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], h = a * a + b * b;
    if(h > 9){ const k = 3 / Math.sqrt(h); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for(let i = 0; i < n - 1; i++){
    const c1x = pts[i][0] + dx[i] / 3, c1y = pts[i][1] + t[i] * dx[i] / 3, c2x = pts[i + 1][0] - dx[i] / 3, c2y = pts[i + 1][1] - t[i + 1] * dx[i] / 3;
    d += `C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${pts[i + 1][0].toFixed(1)} ${pts[i + 1][1].toFixed(1)}`;
  }
  return d;
}
function niceMax39(v){ const p = Math.pow(10, Math.floor(Math.log10(Math.max(1, v)))); return [1, 2, 2.5, 5, 10].map(k => k * p).find(k => k >= v) || v; }
function drawChart39(days){
  const box = $a('g39Chart');
  if(!box) return;
  const W = Math.max(280, box.clientWidth), H = innerWidth < 600 ? 190 : 240;
  const L = 30, R = 10, T = 14, B = 26, iw = W - L - R, ih = H - T - B;
  const max = niceMax39(Math.max(4, ...days.map(x => x.v)));
  const n = days.length, X = (i) => L + (n === 1 ? iw : i / (n - 1) * iw), Y = (v) => T + ih - v / max * ih;
  const pv = days.map((x, i) => [X(i), Y(x.v)]), pu = days.map((x, i) => [X(i), Y(x.u.size)]);
  const lineV = mono39(pv), lineU = mono39(pu);
  const wk = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const every = n <= 7 ? 1 : n <= 14 ? 2 : 5;
  let g = '';
  for(let k = 0; k <= 4; k++){ const v = max * k / 4, y = Y(v); g += `<line x1="${L}" x2="${W - R}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" class="gl"/><text x="${L - 8}" y="${(y + 3.5).toFixed(1)}" class="yl">${Math.round(v)}</text>`; }
  days.forEach((x, i) => { if((n - 1 - i) % every === 0) g += `<text x="${X(i).toFixed(1)}" y="${H - 7}" class="xl${i === n - 1 ? ' now' : ''}">${i === n - 1 ? 'Heute' : n <= 7 ? wk[x.d.getDay()] : x.d.getDate() + '.'}</text>`; });
  const dots = days.map((x, i) => x.reg ? `<circle cx="${pv[i][0].toFixed(1)}" cy="${pv[i][1].toFixed(1)}" r="4" class="reg"/>` : '').join('');
  const last = pv[n - 1];
  box.querySelector('svg') && box.querySelector('svg').remove();
  box.insertAdjacentHTML('afterbegin', `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Besuche der letzten ${n} Tage">
    <defs><linearGradient id="g39Area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9bd86" stop-opacity=".42"/><stop offset=".7" stop-color="#b48a52" stop-opacity=".08"/><stop offset="1" stop-color="#b48a52" stop-opacity="0"/></linearGradient>
    <linearGradient id="g39Line" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b8935a"/><stop offset="1" stop-color="#f3e6c8"/></linearGradient></defs>
    ${g}<path d="${lineV}L${X(n - 1).toFixed(1)} ${T + ih}L${L} ${T + ih}Z" class="area"/>
    <path d="${lineU}" class="lu"/><path d="${lineV}" class="lv" pathLength="1"/>${dots}
    <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="5" class="end"/>
    <line class="cross" x1="0" x2="0" y1="${T}" y2="${T + ih}" visibility="hidden"/><circle class="hov" r="5" visibility="hidden"/></svg>`);
  if(!OV39.counted && !REDUCED39) box.classList.add('draw'); else box.classList.remove('draw');
  OV39.chart = { days, X, Y, pv, n, L, iw, T, ih, W };
}
(() => {
  const box = $a('g39Chart'), tip = $a('g39Tip');
  if(!box) return;
  const hide = () => { tip.hidden = true; const s = box.querySelector('svg'); if(s){ s.querySelector('.cross').setAttribute('visibility', 'hidden'); s.querySelector('.hov').setAttribute('visibility', 'hidden'); } };
  box.addEventListener('pointermove', (e) => {
    const c = OV39.chart, s = box.querySelector('svg');
    if(!c || !s) return;
    const r = box.getBoundingClientRect(), x = e.clientX - r.left;
    const i = Math.max(0, Math.min(c.n - 1, Math.round((x - c.L) / c.iw * (c.n - 1))));
    const d = c.days[i], px = c.pv[i][0], py = c.pv[i][1];
    const cr = s.querySelector('.cross'), hv = s.querySelector('.hov');
    cr.setAttribute('x1', px); cr.setAttribute('x2', px); cr.setAttribute('visibility', 'visible');
    hv.setAttribute('cx', px); hv.setAttribute('cy', py); hv.setAttribute('visibility', 'visible');
    tip.innerHTML = `<b>${d.d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Berlin' })}</b><span><i class="sw a"></i>${d.v} Besuche</span><span><i class="sw l"></i>${d.u.size} Konten aktiv</span>${d.reg ? `<span><i class="sw d"></i>${d.reg} neu</span>` : ''}`;
    tip.hidden = false;
    const tw = tip.offsetWidth;
    tip.style.transform = `translate(${Math.max(4, Math.min(c.W - tw - 4, px - tw / 2))}px, ${Math.max(0, py - tip.offsetHeight - 14)}px)`;
  });
  box.addEventListener('pointerleave', hide);
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if(OV39.chart && !$a('app39').hidden) drawChart39(OV39.chart.days); }, 150); });
})();
