// Website (index.html) mit Supabase-Attrappe: Startseite, Heute, Mehr-Menue, Wartung live, Gate zu/auf.
const { chromium } = require('playwright');
const fs = require('fs');
const S = process.env.SHOTS || require('os').tmpdir();
const MOCK = fs.readFileSync(__dirname + '/supa-mock.js', 'utf8');
const OUT = S + '/s39'; fs.mkdirSync(OUT, { recursive: true });
const only = process.argv[2] || 'all';
const DEV = { desktop: { width: 1440, height: 900 }, ipad: { width: 820, height: 1180 }, phone: { width: 390, height: 844 } };
const wait = (p, ms) => p.waitForTimeout(ms);
async function mk(b, dn, mock){
  const vp = DEV[dn];
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: dn === 'desktop' ? 1 : 2, hasTouch: dn !== 'desktop', isMobile: dn === 'phone' });
  const page = await ctx.newPage(); const errs = [];
  page.on('console', m => { if(m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text().slice(0, 220)); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.route(/cdn\.jsdelivr\.net\/npm\/@supabase/, r => r.fulfill({ body: MOCK, contentType: 'application/javascript' }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: '', contentType: 'text/css' }));
  await page.route(/api\.ipify\.org/, r => r.fulfill({ body: '{"ip":"203.0.113.9"}', contentType: 'application/json' }));
  await page.addInitScript((m) => { window.__MOCK = m; try{ sessionStorage.setItem('lum-load', '1'); }catch(e){} }, mock);
  return { ctx, page, errs };
}
(async () => {
  const b = await chromium.launch();
  for(const dn of Object.keys(DEV)){
    if(only !== 'all' && only !== dn) continue;
    // ---- A: Admin (sieht alles) ----
    { const { ctx, page, errs } = await mk(b, dn, { user: 'admin' });
      await page.goto('http://localhost:8098/index.html', { waitUntil: 'load' }); await wait(page, 3500);
      const hub = await page.evaluate(() => ({ view: lastShownView, src: document.getElementById('hub38Frame').getAttribute('src') }));
      const st = await page.frameLocator('#hub38Frame').locator('.nav [data-action]').evaluateAll(as => as.map(a => a.getAttribute('data-action') + ':' + a.textContent.trim()));
      console.log(dn, 'A Start:', JSON.stringify(hub), 'Kopf der Startseite:', st.join(' | '));
      await page.screenshot({ path: `${OUT}/site-${dn}-start-admin.png` });
      await page.evaluate(() => { goToDestination('today'); window.scrollTo(0, 0); }); await wait(page, 800);
      await page.screenshot({ path: `${OUT}/site-${dn}-heute.png`, fullPage: dn !== 'desktop' });
      const nav = await page.$$eval('.header-nav-item, .quick-nav-item', es => es.filter(e => e.offsetParent).map(e => (e.textContent || e.getAttribute('aria-label')).trim()));
      console.log(dn, 'A sichtbare Navigation:', nav.join(' · '));
      await page.evaluate(() => openNavOverlay()); await wait(page, 500);
      await page.screenshot({ path: `${OUT}/site-${dn}-mehr.png` });
      await page.evaluate(() => closeMore39()); await wait(page, 300);
      const w = await page.evaluate(() => document.documentElement.scrollWidth);
      console.log(dn, 'A Breite', w, 'Konsole:', errs.length ? '\n   ' + errs.join('\n   ') : 'sauber');
      await ctx.close(); }
    if(dn !== 'desktop' && only === 'all') continue;
    // ---- B: normaler Nutzer, Build 39 freigegeben: Wartung live ----
    { const { ctx, page, errs } = await mk(b, dn, { user: 'user', settings: { live_build: 39 } });
      await page.goto('http://localhost:8098/index.html', { waitUntil: 'load' }); await wait(page, 3500);
      console.log(dn, 'B Start:', await page.evaluate(() => lastShownView));
      await page.evaluate(() => { goToDestination('rewards'); }); await wait(page, 600);
      // ganze Website in Wartung - ohne Neuladen
      await page.evaluate(() => { const r = Object.assign({}, window.__MOCKDB.site_settings[0], { maintenance_mode: true, maintenance_message: '', maintenance_until: new Date(Date.now() + 25 * 60000).toISOString() }); window.__MOCKDB.site_settings[0] = r; window.__mockEmit('site_settings', r); });
      await wait(page, 2500);
      console.log(dn, 'B Wartung an -> Rahmen sichtbar:', await page.isVisible('#maint39'));
      await page.screenshot({ path: `${OUT}/site-${dn}-wartung-voll.png` });
      await page.evaluate(() => { const r = Object.assign({}, window.__MOCKDB.site_settings[0], { maintenance_mode: false, feature_maintenance: Object.assign({}, window.__MOCKDB.site_settings[0].feature_maintenance, { rewards: true }) }); window.__MOCKDB.site_settings[0] = r; window.__mockEmit('site_settings', r); });
      await wait(page, 1500);
      console.log(dn, 'B Wartung aus, Spielhalle in Wartung -> Teil-Wartung:', await page.evaluate(() => m39().mode + '/' + m39().feature));
      await page.screenshot({ path: `${OUT}/site-${dn}-wartung-teil.png` });
      // "Lernsets" im Wartungs-Bildschirm antippen
      await page.frameLocator('#maint39Frame').locator('[data-go="home"]').click();
      await wait(page, 900);
      console.log(dn, 'B nach Klick auf Lernsets:', await page.evaluate(() => lastShownView + ' / Rahmen ' + (document.getElementById('maint39').hidden ? 'zu' : 'offen')));
      // Spielhalle oeffnen -> Teil-Wartung, dann Wartung endet -> Spielhalle oeffnet sich von selbst
      await page.evaluate(() => goToDestination('rewards')); await wait(page, 800);
      console.log(dn, 'B Spielhalle oeffnen:', await page.evaluate(() => m39().mode));
      await page.evaluate(() => { const r = Object.assign({}, window.__MOCKDB.site_settings[0], { feature_maintenance: Object.assign({}, window.__MOCKDB.site_settings[0].feature_maintenance, { rewards: false }) }); window.__MOCKDB.site_settings[0] = r; window.__mockEmit('site_settings', r); });
      await wait(page, 1200);
      console.log(dn, 'B Wartung vorbei:', await page.evaluate(() => lastShownView + ' / ' + m39().mode));
      console.log(dn, 'B Klassen sichtbar?', await page.evaluate(() => [...document.querySelectorAll('[data-goto="classes"]')].some(e => e.offsetParent)));
      console.log(dn, 'B Konsole:', errs.length ? '\n   ' + errs.join('\n   ') : 'sauber');
      await ctx.close(); }
    // ---- C: normaler Nutzer, Gate zu (live 38): altes Verhalten ----
    { const { ctx, page, errs } = await mk(b, dn, { user: 'user', settings: { live_build: 38 } });
      await page.goto('http://localhost:8098/index.html', { waitUntil: 'load' }); await wait(page, 3500);
      const nav = await page.$$eval('.header-nav-item', es => es.filter(e => e.offsetParent).map(e => e.textContent.trim()));
      console.log(dn, 'C Gate zu: Start', await page.evaluate(() => lastShownView), '| Navigation:', nav.join(' · '));
      await page.evaluate(() => { const r = Object.assign({}, window.__MOCKDB.site_settings[0], { maintenance_mode: true }); window.__MOCKDB.site_settings[0] = r; window.__mockEmit('site_settings', r); });
      await wait(page, 1200);
      console.log(dn, 'C alte Wartung live:', await page.isVisible('#maintenanceOverlay'));
      console.log(dn, 'C Konsole:', errs.length ? '\n   ' + errs.join('\n   ') : 'sauber');
      await ctx.close(); }
    // ---- D: Gast mit Build 39 ----
    { const { ctx, page, errs } = await mk(b, dn, { user: null, settings: { live_build: 39 } });
      await page.goto('http://localhost:8098/index.html', { waitUntil: 'load' }); await wait(page, 3500);
      const st = await page.frameLocator('#hub38Frame').locator('.nav [data-action]').evaluateAll(as => as.map(a => a.getAttribute('data-action')));
      console.log(dn, 'D Gast: Start', await page.evaluate(() => lastShownView), '| Knoepfe', st.join(','), '| Konsole:', errs.length ? errs.join(' | ') : 'sauber');
      await ctx.close(); }
  }
  await b.close();
})();
