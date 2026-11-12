// ==================== Build 39: Wartung sofort, Startseite zuerst, Mehr-Menue, ohne Klassen ====================
// Alles Neue haengt an isReleased(39). Sofort fuer alle gilt nur: Website-Einstellungen kommen live an
// (Realtime auf site_settings + Abfrage alle 20 s), damit eine Wartung nicht erst nach dem Neuladen greift.
// Zustand ueber eine Funktion statt let/const: applyMaintenanceMode() kann vor diesem Block laufen (TDZ).
function m39(){ return window.__m39 || (window.__m39 = { ch: null, poll: 0, mode: null, feature: null, ready: false }); }
// Welche Seite zu welchem Wartungs-Schalter gehoert (Schluessel wie im Admin unter "Einzelne Bereiche")
var FEAT39 = { home: 'home', set: 'home', sessionSetup: 'home', practice: 'home', match: 'home', results: 'home',
  listen: 'listen', rewards: 'rewards', arcadeGame: 'rewards', game: 'rewards', grammar: 'grammar', calendar: 'calendar', appDownload: 'appDownload', about: 'about' };
function featName39(key){
  return { home: 'Die Lernsets', listen: 'Die Aussprache', rewards: 'Die Spielhalle', grammar: 'Die Grammatik', calendar: 'Der Kalender', appDownload: 'Die App-Seite', about: 'Die Über-uns-Seite' }[key] || 'Dieser Bereich';
}
function maint39Data(mode, feature){
  const ss = siteSettings || {}, fm = ss.feature_maintenance || {};
  return {
    lumiere: 'maint', mode, feature: feature || null, label: feature ? featName39(feature) : '', plural: feature === 'home',
    message: ss.maintenance_message || '', until: ss.maintenance_until || null,
    paused: Object.keys(fm).filter(k => fm[k]),
    features: ADMIN_FEATURE_LIST.map(f => ({ key: f.key, label: f.key === 'rewards' ? 'Spielhalle' : f.label })),
  };
}
function setInert39(on){
  for(const el of document.body.children){
    if(el.id === 'maint39' || el.id === 'banScreen' || el.id === 'toast' || el.tagName === 'SCRIPT') continue;
    el.inert = on;
  }
}
function showMaint39(mode, feature){
  const st = m39(), box = document.getElementById('maint39'), fr = document.getElementById('maint39Frame');
  if(!box || !fr) return;
  if(!mode){
    if(box.hidden) return;
    st.mode = null; st.feature = null;
    box.classList.remove('on');
    setInert39(false);
    document.documentElement.classList.remove('maint39-open');
    setTimeout(() => { if(!st.mode){ box.hidden = true; fr.removeAttribute('src'); st.ready = false; } }, 500);
    return;
  }
  const fresh = !st.mode;
  st.mode = mode; st.feature = feature || null;
  box.hidden = false;
  requestAnimationFrame(() => box.classList.add('on'));
  setInert39(true);
  document.documentElement.classList.add('maint39-open');
  if(!fr.getAttribute('src')){ st.ready = false; fr.setAttribute('src', 'wartung.html?embed=1&v=' + APP_VERSION); }
  else if(st.ready && fr.contentWindow) fr.contentWindow.postMessage(maint39Data(mode, feature), location.origin);
  if(fresh){
    try{ stopAllGames(); }catch(e){}
    try{ musicStop(); }catch(e){}
    try{ closeNavOverlay(); closeMore39(); }catch(e){}
    if('speechSynthesis' in window) speechSynthesis.cancel();
  }
}
// Entscheidet bei jeder Aenderung der Einstellungen neu (auch live, ohne Neuladen).
function maint39Apply(isAdmin){
  const st = m39(), ss = siteSettings || {};
  if(isAdmin){ showMaint39(null); return; }
  if(ss.maintenance_mode){ showMaint39('full'); return; }
  const fm = ss.feature_maintenance || {};
  if(st.mode === 'full'){
    showMaint39(null);
    const cur = FEAT39[lastShownView];
    if(cur && fm[cur]){ showMaint39('partial', cur); return; }
    showToast('Willkommen zurück – alles läuft wieder.');
    return;
  }
  if(st.mode === 'partial'){
    const f = st.feature;
    if(f && !fm[f]){ showMaint39(null); showToast(featName39(f) + (f === 'home' ? ' sind' : ' ist') + ' wieder da.'); goToDestination(f); return; }
    showMaint39('partial', f);
    return;
  }
  // Geht der Bereich in Wartung, in dem man gerade ist: sofort der Hinweis
  const cur = FEAT39[lastShownView];
  if(cur && fm[cur]) showMaint39('partial', cur);
}
window.addEventListener('message', (e) => {
  if(e.origin !== location.origin || !e.data || typeof e.data.lumiere !== 'string') return;
  const st = m39(), a = e.data.lumiere, fr = document.getElementById('maint39Frame');
  if(a === 'maint-ready' && fr && e.source === fr.contentWindow){
    st.ready = true;
    if(st.mode) fr.contentWindow.postMessage(maint39Data(st.mode, st.feature), location.origin);
  } else if(a === 'maint-go' && st.mode === 'partial'){
    showMaint39(null); goToDestination(e.data.view);
  } else if(a === 'maint-back' && st.mode === 'partial'){
    const f = st.feature;
    showMaint39(null);
    if(FEAT39[lastShownView] === f) goToDestination(currentUser ? 'today' : 'hub');
  } else if(a === 'hello'){
    postState39();
  }
});

// ---- Live-Einstellungen (sofort fuer alle) ----
function watchSettings39(){
  const st = m39();
  if(!sb || st.ch) return;
  try{
    st.ch = sb.channel('lumiere-settings')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'site_settings' }, (pl) => {
        if(!pl || !pl.new || pl.new.id !== 1) return;
        const before = siteSettings ? JSON.stringify(siteSettings) : '';
        siteSettings = Object.assign({}, siteSettings || {}, pl.new);
        if(before !== JSON.stringify(siteSettings)){ applyMaintenanceMode(); applyReleaseGate(); }
      })
      .subscribe();
  }catch(e){ st.ch = { failed: true }; }
  // Netz unter dem Netz: Realtime kann (Firmen-WLAN, Energiesparen) wegbrechen.
  st.poll = setInterval(() => { if(!document.hidden) loadSiteSettings(); }, 20000);
  document.addEventListener('visibilitychange', () => { if(!document.hidden) loadSiteSettings(); });
  window.addEventListener('online', () => loadSiteSettings());
}

// ---- Klassen-Sets werden normale Sets ----
function unclass39(){
  if(!isReleased(39) || !store || !Array.isArray(store.sets)) return;
  let ch = false;
  store.sets.forEach(s => {
    if(s.classSetId || s.classId || s.readOnly || s.className){ delete s.classSetId; delete s.classId; delete s.className; delete s.readOnly; ch = true; }
  });
  if(ch){ saveData(store); try{ if(views.home && !views.home.hidden) renderHome(); }catch(e){} }
}

// ---- Startseite: Angemeldete sehen sie auch, mit "Weiter lernen" ----
function postState39(){
  const f = document.getElementById('hub38Frame');
  if(!f || !f.contentWindow || !f.getAttribute('src')) return;
  let user = null;
  if(currentUser && isReleased(39)){
    const name = (currentProfile && currentProfile.display_name) || (currentUser.email || '').split('@')[0] || '';
    let due = 0;
    try{ (store.sets || []).forEach(s => s.pairs.forEach(p => { if(isPairDue(p)) due++; })); }catch(e){}
    user = { name, initials: lbInitials(name), due };
  }
  try{ f.contentWindow.postMessage({ lumiere: 'state', user }, location.origin); }catch(e){}
}

// ---- Kopfleiste: Serie + Coins ----
function updateHeaderStats39(){
  const s = document.getElementById('hs39Streak'), c = document.getElementById('hs39Coins');
  if(!s || !c) return;
  try{ s.textContent = computeCurrentStreak(); }catch(e){}
  try{ c.textContent = getCoins(); }catch(e){}
}
document.getElementById('hstat39').addEventListener('click', () => { sndClick(); renderRewards(); });
window.addEventListener('lumiere:viewchange', updateHeaderStats39);

// ---- Mehr-Menue: Aufklapper (PC) bzw. Blatt von unten (Handy/iPad) ----
function openMore39(){
  const m = document.getElementById('more39');
  if(!m || !m.hidden) return closeMore39();
  try{ sndMenuOpen(); }catch(e){}
  m.querySelectorAll('[data-goto39]').forEach(b => b.classList.toggle('active', b.dataset.goto39 === currentNavId));
  m.hidden = false;
  requestAnimationFrame(() => m.classList.add('on'));
  document.querySelectorAll('[data-more38], #quickNavMenu, #btnMenu').forEach(b => b.setAttribute('aria-expanded', 'true'));
}
function closeMore39(){
  const m = document.getElementById('more39');
  if(!m || m.hidden) return;
  m.classList.remove('on');
  document.querySelectorAll('[data-more38], #quickNavMenu, #btnMenu').forEach(b => b.setAttribute('aria-expanded', 'false'));
  setTimeout(() => { if(!m.classList.contains('on')) m.hidden = true; }, 260);
}
document.getElementById('more39').addEventListener('click', (e) => {
  const it = e.target.closest('[data-goto39]');
  if(it){ sndClick(); closeMore39(); goToDestination(it.dataset.goto39); return; }
  if(e.target.closest('[data-more39-close]')) closeMore39();
});
document.addEventListener('keydown', (e) => { if(e.key === 'Escape') closeMore39(); });
window.addEventListener('lumiere:viewchange', closeMore39);

// Nach jedem Gate-Wechsel
function onGate39(){
  if(!isReleased(39)) return;
  // Build 38 hat vor dem Laden des Profils schon von der Startseite auf "Heute" umgeleitet - zurueck.
  if(window.__redir38 && lastShownView === 'today'){ window.__redir38 = false; renderHub(); }
  unclass39();
  updateHeaderStats39();
  postState39();
}
