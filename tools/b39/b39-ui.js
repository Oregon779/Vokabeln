
// ---- Build 39: Heute - Woche und schwierige Woerter ----
function renderToday39(){
  const plot = document.getElementById('t39Bars');
  if(!plot) return;
  const dp = store.dailyProgress || {}, goal = (store.settings && store.settings.dailyGoal) || 20;
  const wk = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'], days = [];
  for(let i = 6; i >= 0; i--){ const d = new Date(); d.setDate(d.getDate() - i); days.push({ d, v: dp[todayKey(d)] || 0 }); }
  const max = Math.max(goal * 1.15, ...days.map(x => x.v), 1);
  plot.innerHTML = `<span class="t39-goal" style="bottom:${(goal / max * 100).toFixed(1)}%"><em>Ziel ${goal}</em></span>` + days.map((x, i) =>
    `<div class="t39-bar${i === 6 ? ' today' : ''}${x.v >= goal ? ' done' : ''}"><b>${x.v || ''}</b><i style="height:${(x.v / max * 100).toFixed(1)}%"></i><em>${i === 6 ? 'Heute' : wk[x.d.getDay()]}</em></div>`).join('');
  document.getElementById('t39WeekSum').textContent = days.reduce((a, x) => a + x.v, 0);
  document.getElementById('t39WeekGoal').textContent = days.filter(x => x.v >= goal).length;
  // Woerter, die oft falsch waren (und noch nicht sicher sitzen)
  const hard = [];
  (store.sets || []).forEach(s => s.pairs.forEach(p => {
    const st = ensurePairStats(p);
    if(st.wrong > 0 && st.box < 4) hard.push({ p, s, score: st.wrong * 2 - st.correct, wrong: st.wrong });
  }));
  hard.sort((a, b) => b.score - a.score || b.wrong - a.wrong);
  const box = document.getElementById('t39Hard');
  box.innerHTML = hard.length ? hard.slice(0, 5).map(x =>
    `<button type="button" class="t39-hw" data-practice38="${escapeHtml(String(x.s.id))}"><span class="fr">${escapeHtml(x.p.fr)}</span><span class="de">${escapeHtml(x.p.de)}</span><span class="n">${x.wrong}× falsch</span></button>`).join('')
    : '<p class="t38-empty">Noch keine – sobald du übst, stehen hier die Wörter, die dir am schwersten fallen.</p>';
}

// ---- Build 39: Spielhalle - Serie in der Stand-Leiste ----
window.addEventListener('lumiere:viewchange', (e) => {
  if(!e.detail || e.detail.view !== 'rewards') return;
  const el = document.getElementById('arc39Streak');
  if(el) try{ el.textContent = computeCurrentStreak(); }catch(err){}
});

// ---- Build 39: Mein Konto mit Reitern ----
var ACC39 = { profil: ['accProfileTitle', 'accSyncTitle'], tarif: ['accUsageTitle', 'accPlansTitle'], nachrichten: ['accMsgTitle'], sicherheit: ['accPwViewTitle', 'accSecTitle', 'accDangerTitle'] };
function setupAcc39(){
  const view = document.getElementById('view-account');
  if(!view || view.querySelector('.acc39-tabs')) return;
  Object.keys(ACC39).forEach(tab => ACC39[tab].forEach(id => {
    const card = view.querySelector(`.acc-card[aria-labelledby="${id}"]`);
    if(card) card.setAttribute('data-acc39', tab);
  }));
  const bar = document.createElement('div');
  bar.className = 'acc39-tabs';
  bar.setAttribute('role', 'tablist');
  bar.innerHTML = [['profil', 'Profil'], ['tarif', 'Tarif'], ['nachrichten', 'Nachrichten'], ['sicherheit', 'Sicherheit']]
    .map(([k, l]) => `<button type="button" role="tab" data-acc39tab="${k}">${l}${k === 'nachrichten' ? '<i class="acc39-n" hidden></i>' : ''}</button>`).join('');
  const head = view.querySelector('.acc-hero') || view.querySelector('.acc-wrap > *');
  head.insertAdjacentElement('afterend', bar);
  bar.addEventListener('click', (e) => { const b = e.target.closest('[data-acc39tab]'); if(b){ sndClick(); accTab39(b.dataset.acc39tab); } });
}
function accTab39(tab){
  const view = document.getElementById('view-account');
  if(!view) return;
  view.setAttribute('data-tab39', tab);
  view.querySelectorAll('[data-acc39tab]').forEach(b => { const on = b.dataset.acc39tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
  try{ sessionStorage.setItem('lumiere_acc_tab39', tab); }catch(e){}
}
window.addEventListener('lumiere:viewchange', (e) => {
  if(!e.detail || e.detail.view !== 'account' || !isReleased(39)) return;
  setupAcc39();
  let t = 'profil';
  try{ t = sessionStorage.getItem('lumiere_acc_tab39') || 'profil'; }catch(err){}
  // ungelesene Nachrichten: Zahl am Reiter
  const cnt = document.getElementById('accMsgCount'), n = document.querySelector('.acc39-n');
  if(n && cnt){ n.hidden = cnt.hidden || !cnt.textContent.trim(); n.textContent = cnt.textContent.trim(); }
  accTab39(ACC39[t] ? t : 'profil');
});

// ---- Build 39: Einstellungen - Sprung-Leiste, leere Rubriken weg ----
function setupSet39(){
  const view = document.getElementById('view-settings');
  if(!view) return;
  const clusters = [...view.querySelectorAll('.settings-cluster')];
  clusters.forEach(c => {
    const cards = [...c.querySelectorAll('.settings-card')];
    c.classList.toggle('empty39', cards.length > 0 && cards.every(k => getComputedStyle(k).display === 'none'));
  });
  let nav = view.querySelector('.set39-nav');
  if(!nav){
    nav = document.createElement('nav');
    nav.className = 'set39-nav';
    nav.setAttribute('aria-label', 'Bereiche der Einstellungen');
    const first = clusters[0];
    if(!first) return;
    first.parentNode.insertBefore(nav, first);
    nav.addEventListener('click', (e) => {
      const b = e.target.closest('[data-set39]');
      if(!b) return;
      const c = clusters[Number(b.dataset.set39)];
      if(c){ sndClick(); const y = c.getBoundingClientRect().top + scrollY - 130; window.scrollTo({ top: y, behavior: 'smooth' }); }
    });
  }
  nav.innerHTML = clusters.map((c, i) => {
    if(c.classList.contains('empty39') || getComputedStyle(c).display === 'none') return '';
    const h = c.querySelector('.settings-cluster-head h2');
    return h ? `<button type="button" data-set39="${i}">${escapeHtml(h.textContent.trim())}</button>` : '';
  }).join('');
}
window.addEventListener('lumiere:viewchange', (e) => {
  if(e.detail && e.detail.view === 'settingsPage' && isReleased(39)) setTimeout(setupSet39, 0);
});
