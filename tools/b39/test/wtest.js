const { chromium } = require('playwright');
const OUT = (process.env.SHOTS || require('os').tmpdir()) + '/s39'; require('fs').mkdirSync(OUT, { recursive: true });
const DEV = { desktop: { width: 1440, height: 900 }, ipad: { width: 820, height: 1180 }, phone: { width: 390, height: 844 } };
(async () => { const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
 for(const [dn, vp] of Object.entries(DEV)) for(const mode of ['voll', 'teil']){
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1 }); const p = await ctx.newPage(); const errs = [];
  p.on('console', m => { if(m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); }); p.on('pageerror', e => errs.push(e.message));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: '', contentType: 'text/css' }));
  await p.goto(`http://localhost:8098/wartung.html?vorschau=1&hq=1${mode === 'teil' ? '&modus=teil' : ''}`); await p.waitForTimeout(4000);
  // Bildzeit
  const ft = await p.evaluate(() => new Promise(res => { const ts = []; let n = 0; function f(t){ ts.push(t); if(++n < 40) requestAnimationFrame(f); else { const d = ts.slice(1).map((x, i) => x - ts[i]).sort((a, b) => a - b); res([d[d.length >> 1].toFixed(1), d[Math.floor(d.length * .95)].toFixed(1)]); } } requestAnimationFrame(f); }));
  await p.screenshot({ path: `${OUT}/w-${dn}-${mode}.png` });
  console.log(dn, mode, 'Bildzeit Mitte/p95 ms', ft.join(' / '), 'Konsole:', errs.length ? errs.join(' | ') : 'sauber');
  await ctx.close(); }
 await b.close(); })();
