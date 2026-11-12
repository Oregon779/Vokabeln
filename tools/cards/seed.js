// Gemeinsame Beispieldaten fuer Aufnahmen (Lea, vier Sets, zwei Klausuren, Muenzen).
const mk = (de, fr) => ({ de, fr });
exports.SETS = [
  { id: 's1', name: 'Klausur Kapitel 4 – Le voyage', pairs: [['die Reise','le voyage'],['der Bahnhof','la gare'],['der Koffer','la valise'],['das Flugzeug','l\'avion'],['die Fahrkarte','le billet'],['ankommen','arriver'],['abfahren','partir'],['der Strand','la plage'],['das Meer','la mer'],['die Sonne','le soleil'],['übernachten','passer la nuit'],['das Zimmer','la chambre']] },
  { id: 's2', name: 'Im Café', pairs: [['der Kaffee','le café'],['das Croissant','le croissant'],['die Rechnung','l\'addition'],['bestellen','commander'],['der Kellner','le serveur'],['die Speisekarte','la carte'],['lecker','délicieux'],['das Glas','le verre']] },
  { id: 's3', name: 'Verben – passé composé', pairs: [['ich habe gegessen','j\'ai mangé'],['du bist gegangen','tu es allé'],['wir haben gesehen','nous avons vu'],['sie sind gekommen','ils sont venus'],['ich habe gemacht','j\'ai fait'],['er hat genommen','il a pris']] },
  { id: 's4', name: 'Grundwortschatz', pairs: [['Hallo','Bonjour'],['Danke','Merci'],['das Haus','la maison'],['der Hund','le chien'],['lernen','apprendre'],['schön','beau'],['groß','grand'],['klein','petit'],['gut','bon'],['die Schule','l\'école']] },
];
exports.seed = async (page) => {
  await page.evaluate((RAW) => {
    currentUser = { id: 'me', email: 'lea@example.com', created_at: '2026-01-04T10:00:00Z', user_metadata: { display_name: 'Léa' } };
    currentProfile = { user_id: 'me', is_admin: false, display_name: 'Léa', ai_requests_today: 3, ai_requests_date: berlinToday() };
    siteSettings = Object.assign(siteSettings || {}, { live_build: 30, ai_daily_limit: 50 });
    store.sets = RAW.map((s, si) => ({ id: s.id, name: s.name, pairs: s.pairs.map((p, i) => {
      const q = makePair(p[0], p[1]);
      const box = [3, 2, 1, 4][si] + (i % 3) - 1;
      Object.assign(q.stats, { box: Math.max(0, box), seen: 4 + i, correct: 3 + i % 4, wrong: i % 3,
        lastSeen: Date.now() - (si + 1) * 3600e3 * 20, due: i % 4 === 0 ? todayKey() : '2026-10-02' });
      return q; }) }));
    const d = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
    store.examEvents = [
      { id: 'e1', notifiedDays: [], type: 'Klassenarbeit', title: 'Französisch – Kapitel 4', date: d(5), time: '08:00', topics: 'Le voyage, passé composé', notes: '', linkedSetIds: ['s1', 's3'], checklist: [{ text: 'Vokabeln Kapitel 4', done: true }, { text: 'passé composé üben', done: false }] },
      { id: 'e2', notifiedDays: [], type: 'Vokabeltest', title: 'Vokabeltest Café', date: d(12), time: '09:45', topics: '', notes: '', linkedSetIds: ['s2'], checklist: [] },
    ];
    try{ store.coins = 340; }catch(e){}
    try{ for(let i = 0; i < 9; i++){ const x = new Date(); x.setDate(x.getDate() - i); (store.streakDates = store.streakDates || []).push(todayKey(x)); } }catch(e){}
    writeStoreToDisk(store);
    try{ applyReleaseGate(); updateAccountUI(); updateCoinDisplays && updateCoinDisplays(); }catch(e){}
    const st = document.createElement('style');
    st.textContent = '.preview-badge,.toast,#toast,.site-header,.quick-nav,.site-foot,#updateBanner{display:none!important} body{padding-top:0!important} *{cursor:none!important}';
    document.head.appendChild(st);
  }, exports.SETS);
};
