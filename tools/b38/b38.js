// ==================== Build 38: "Maison Noir" - Heute, Gaeste-Startseite, Navigation ====================
// Angemeldete landen auf "Heute" (faellige Woerter, Tagesziel, Serie, naechste Klausur, Sets).
// Gaeste sehen die neue Startseite (start.html) in einem Rahmen; ihre Knoepfe melden sich per
// postMessage (Registrieren, Anmelden, Gast, Seitenwechsel). Die 3D-Reise und ihre Musik laufen
// unter Build 38 nicht mehr.
views.today = document.getElementById('view-today');
var guestPreview38 = false;
function practiceSet38(setId){
  renderSetDetail(setId);
  sessionConfig.selection = 'srs';
  const go = document.getElementById('btnGoPractice');
  if(go) go.click();
}
function renderToday38(){
  guestPreview38 = false;
  showView('today');
  currentNavId = 'hub';
  updateNavActiveStates();
  const $t = (id) => document.getElementById(id);
  const now = new Date(), h = now.getHours();
  const name = (currentProfile && currentProfile.display_name) || (currentUser && currentUser.email ? currentUser.email.split('@')[0] : '');
  $t('t38Date').textContent = now.toLocaleDateString('de-DE', { weekday:'long', day:'numeric', month:'long' });
  $t('t38Greet').textContent = h < 5 ? 'Bonne nuit' : h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  $t('t38Name').textContent = name || 'toi';
  const sets = (store.sets || []).map(s => {
    let due = 0, learned = 0;
    s.pairs.forEach(p => { if(isPairDue(p)) due++; if(ensurePairStats(p).box >= 3) learned++; });
    return { s, due, learned, total:s.pairs.length };
  });
  const totalDue = sets.reduce((a, x) => a + x.due, 0);
  $t('t38Due').textContent = totalDue;
  $t('t38DueUnit').textContent = totalDue === 1 ? 'Wort' : 'Wörter';
  const withDue = sets.filter(x => x.due > 0).sort((a, b) => b.due - a.due);
  $t('t38Lead').textContent = sets.length === 0 ? 'Leg dein erstes Set an – zehn Wörter reichen für den Anfang.'
    : totalDue > 0 ? 'Ein paar Minuten reichen. Die Wörter kommen genau dann, wenn du sie sonst vergessen würdest.'
    : 'Heute ist alles wiederholt. Zeit für ein paar neue Wörter?';
  $t('t38DueNote').textContent = sets.length === 0 ? 'Noch keine Lernsets.'
    : withDue.length ? `Die meisten in „${withDue[0].s.name}“${withDue.length > 1 ? ` und ${withDue.length - 1} weiteren Set${withDue.length > 2 ? 's' : ''}` : ''}.`
    : 'Alles wiederholt – die nächsten kommen morgen.';
  const go = $t('t38Go');
  go.textContent = sets.length === 0 ? 'Erstes Set anlegen' : totalDue > 0 ? 'Weiter lernen' : 'Neue Wörter lernen';
  go.onclick = () => { sndClick(); if(withDue.length) practiceSet38(withDue[0].s.id); else renderHome(); };
  // Tagesziel
  const goal = store.settings.dailyGoal || 20, done = (store.dailyProgress || {})[todayKey()] || 0, f = Math.min(1, done / goal);
  $t('t38GoalDone').textContent = done;
  $t('t38GoalOf').textContent = 'von ' + goal;
  $t('t38Ring').setAttribute('stroke-dashoffset', (339.3 * (1 - f)).toFixed(1));
  $t('t38GoalNote').textContent = done >= goal ? 'Geschafft für heute.' : `Noch ${goal - done} bis zum Ziel.`;
  // Serie + die letzten sieben Tage
  const streak = computeCurrentStreak(), days = new Set(store.streakDates || []);
  $t('t38Streak').textContent = streak;
  $t('t38StreakUnit').textContent = streak === 1 ? 'Tag' : 'Tage';
  const wk = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  let wh = '';
  for(let i = 6; i >= 0; i--){
    const d = new Date(now); d.setDate(d.getDate() - i);
    wh += `<i class="${days.has(todayKey(d)) ? 'on' : ''}${i === 0 ? ' today' : ''}" title="${d.toLocaleDateString('de-DE')}">${wk[d.getDay()].charAt(0)}</i>`;
  }
  $t('t38Week').innerHTML = wh;
  // naechste Klausur
  let ex = null, exDays = Infinity;
  (store.examEvents || []).forEach(ev => { const n = daysUntilDate(ev.date); if(n >= 0 && n < exDays){ ex = ev; exDays = n; } });
  if(ex){
    $t('t38ExamLabel').textContent = exDays === 0 ? 'Heute' : exDays === 1 ? 'Morgen' : `In ${exDays} Tagen`;
    $t('t38ExamT').textContent = `${ex.type || 'Klausur'}${ex.title ? ' „' + ex.title + '“' : ''}`;
    $t('t38ExamNote').textContent = ex.topics ? 'Themen: ' + ex.topics : 'Im Kalender kannst du Themen ergänzen.';
  } else {
    $t('t38ExamLabel').textContent = 'Nächste Klausur';
    $t('t38ExamT').textContent = 'Nichts eingetragen';
    $t('t38ExamNote').innerHTML = 'Trag deine nächste Arbeit im <button type="button" class="t38-link" data-goto38="calendar">Kalender</button> ein – dann plant Lumière mit.';
  }
  // Sets: zuerst die mit faelligen Woertern
  const list = [...sets].sort((a, b) => (b.due - a.due) || a.s.name.localeCompare(b.s.name)).slice(0, 5);
  $t('t38Sets').innerHTML = list.length ? list.map(x => {
    const pct = x.total ? Math.round(x.learned / x.total * 100) : 0;
    return `<div class="t38-set"><div><p class="t38-set-name">${escapeHtml(x.s.name)}</p><p class="t38-set-meta">`
      + (x.s.classSetId ? `<span>Klasse · ${escapeHtml(x.s.className || '')}</span>` : '')
      + `<span>${x.total} Vokabel${x.total === 1 ? '' : 'n'}</span><span class="t38-set-bar" aria-hidden="true"><i style="width:${pct}%"></i></span><span>${pct} % sicher</span>`
      + (x.due ? `<span class="t38-set-due">${x.due} fällig</span>` : '')
      + `</p></div><button type="button" class="btn ${x.due ? 'btn-primary' : 'btn-secondary'}" data-practice38="${escapeHtml(String(x.s.id))}">${x.due ? 'Üben' : 'Öffnen'}</button></div>`;
  }).join('') : '<p class="t38-empty">Noch keine Lernsets – leg unter „Lernsets“ dein erstes an.</p>';
}
function showGuestStart38(preview){
  guestPreview38 = !!preview;
  showView('hub');
  currentNavId = 'hub';
  updateNavActiveStates();
  const f = document.getElementById('hub38Frame');
  if(f && !f.getAttribute('src')) f.setAttribute('src', 'start.html?v=' + APP_VERSION);
}
document.getElementById('view-today').addEventListener('click', (e) => {
  const p = e.target.closest('[data-practice38]');
  if(p){ sndClick(); const set = (store.sets || []).find(s => String(s.id) === p.dataset.practice38); if(!set) return; if(set.pairs.some(isPairDue)) practiceSet38(set.id); else renderSetDetail(set.id); return; }
  const g = e.target.closest('[data-goto38]');
  if(g){ sndClick(); goToDestination(g.dataset.goto38); }
});
document.getElementById('t38AllSets').addEventListener('click', () => { sndClick(); renderHome(); });
// Knoepfe der Gaeste-Startseite (start.html im Rahmen)
window.addEventListener('message', (e) => {
  if(e.origin !== location.origin || !e.data || typeof e.data.lumiere !== 'string') return;
  const a = e.data.lumiere;
  if(a === 'signup' || a === 'login'){
    if(currentUser){ renderToday38(); return; }
    openAccountModal();
    const chip = document.querySelector(`#authTabChips .chip[data-tab="${a === 'signup' ? 'signup' : 'signin'}"]`);
    if(chip) chip.click();
  } else if(a === 'guest') renderHome();
  else if(a === 'goto' && e.data.view) goToDestination(e.data.view);
});
// "Mehr" in Kopfleiste und Tab-Leiste oeffnet das bisherige Vollbild-Menue
document.querySelectorAll('[data-more38]').forEach(b => b.addEventListener('click', () => { sndClick(); openNavOverlay(); }));
document.querySelectorAll('[data-goto-special38]').forEach(b => b.addEventListener('click', () => {
  sndClick(); closeNavOverlay();
  if(b.dataset.gotoSpecial38 === 'guestStart') showGuestStart38(true);
  else if(b.dataset.gotoSpecial38 === 'admin' && typeof openAdminPanel === 'function') openAdminPanel();
}));
// Nach jedem Gate-Wechsel: 3D-Reise anhalten, Musik aus, Startseite neu zuordnen
function onGate38(){
  const on = isReleased(38);
  document.body.classList.toggle('is-admin38', !!(currentProfile && currentProfile.is_admin));
  if(!on) return;
  if(window.cineFieldStop) window.cineFieldStop();
  try{ musicSync(); }catch(e){}
  try{ applySettingsToUI(); }catch(e){}
  if(lastShownView === 'hub' && !guestPreview38 && currentUser) renderToday38();
  else if(lastShownView === 'hub' && !currentUser) showGuestStart38(false);
}
