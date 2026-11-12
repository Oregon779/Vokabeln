// Admin-Seite mit Supabase-Attrappe durchklicken: alle Reiter, Dialoge, drei Geraete.
const { chromium } = require('playwright');
const fs = require('fs');
const S = process.env.SHOTS || require('os').tmpdir();
const MOCK = fs.readFileSync(__dirname + '/supa-mock.js', 'utf8');
const TOK = '0123456789abcdef0123456789abcdef0123456789abcdef';
const OUT = S + '/s39'; fs.mkdirSync(OUT, { recursive: true });
const only = process.argv[2] || 'all';
const DEV = { desktop: { width: 1440, height: 900 }, ipad: { width: 820, height: 1180 }, phone: { width: 390, height: 844 } };
(async () => {
  const b = await chromium.launch();
  for(const [dn, vp] of Object.entries(DEV)){
    if(only !== 'all' && only !== dn) continue;
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: dn === 'desktop' ? 1 : 2, hasTouch: dn !== 'desktop', isMobile: dn === 'phone' });
    const errs = [];
    const page = await ctx.newPage();
    page.on('console', m => { if(m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    await page.route(/cdn\.jsdelivr\.net\/npm\/@supabase/, r => r.fulfill({ body: MOCK, contentType: 'application/javascript' }));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: '', contentType: 'text/css' }));
    await page.addInitScript(() => { window.__MOCK = { user: 'admin' }; });
    // 1) ohne Schluessel -> 404
    if(dn === 'desktop'){
      await page.goto('http://localhost:8098/admin.html', { waitUntil: 'load' });
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/adm-404.png` });
      console.log('404 sichtbar:', await page.isVisible('#gate39'));
    }
    await page.goto(`http://localhost:8098/admin.html#k=${TOK}`, { waitUntil: 'load' });
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1500);
    console.log(dn, 'app sichtbar:', await page.isVisible('#app39'));
    await page.evaluate(() => localStorage.removeItem('lumiere_admin_tab39'));
    await page.screenshot({ path: `${OUT}/adm-${dn}-overview.png`, fullPage: dn !== 'desktop' });
    const tabs = await page.$$eval('#adminSubnav [data-admin-tab]', bs => bs.map(b => b.dataset.adminTab));
    for(const t of tabs){
      await page.evaluate((t) => { switchAdminTab(t); window.scrollTo(0, 0); }, t);
      await page.waitForTimeout(t === 'maintenance' ? 1500 : 500);
      if(dn === 'desktop' || ['users', 'maintenance', 'photos'].includes(t)) await page.screenshot({ path: `${OUT}/adm-${dn}-${t}.png`, fullPage: true });
    }
    if(dn === 'desktop'){
      // Dialoge: Nutzer-Menue -> Umbenennen, Profilbild-Dialog
      await page.evaluate(() => switchAdminTab('users'));
      await page.waitForTimeout(400);
      const p = await page.evaluate(() => { const p = window.__MOCKDB.profiles[3]; admOpen('ban', p); return p.display_name; });
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/adm-dlg-ban.png` });
      await page.evaluate(() => admClose());
      await page.waitForTimeout(300);
      await page.evaluate(() => openPadDlg('u-2', { review: true }));
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${OUT}/adm-dlg-pad.png` });
      await page.evaluate(() => closePadDlg());
      // Wartung einschalten ueber Schnellschalter
      await page.click('#a39Mt');
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/adm-mt-confirm.png` });
      await page.click('#modalConfirm').catch(() => {});
      await page.waitForTimeout(800);
      console.log('Wartung an:', await page.evaluate(() => window.__MOCKDB.site_settings[0].maintenance_mode));
    }
    if(dn === 'phone'){
      await page.evaluate(() => { switchAdminTab('overview'); window.scrollTo(0, 0); });
      await page.click('#adminSidebarToggle');
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/adm-phone-drawer.png` });
    }
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    console.log(dn, 'Breite', w, '/', vp.width);
    console.log(dn, 'Konsole:', errs.length ? errs.join('\n  ') : 'sauber');
    await ctx.close();
  }
  await b.close();
})();
