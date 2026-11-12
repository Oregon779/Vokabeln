// Karten-Videos (Build 30): echte Bedienung der Seite, per CDP-Screencast
// in Echtzeit aufgenommen, dann mit ffmpeg zu einer Schleife gebaut.
// Seite vorher lokal starten (python3 tools/rangeserver.py 8097 .), dann:
//   node tools/cards/record.js <name|all>      -> $WORK/<name>-raw.mp4
//   python3 tools/cards/encode.py              -> $WORK/out/card-<name>.{mp4,webm,webp}
// Umgebung: WORK (Arbeitsordner, Standard tools/cards/work), PLAYWRIGHT (Modulpfad),
// SUPABASE_UMD (lokale supabase.js, sonst kommt sie vom CDN).
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const OUT = (process.env.WORK || path.join(__dirname, 'work')) + '/';
const FF = execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();
const { seed } = require('./seed.js');
const ONLY = process.argv[2] || 'all';
const W = 1024, H = 640, DPR = 1.75;

const CURSOR = () => {
  const c = document.createElement('div');
  c.id = '__fc';
  c.style.cssText = 'position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;z-index:2147483647;pointer-events:none;' +
    'border:2px solid rgba(255,236,190,.95);background:rgba(246,195,92,.28);box-shadow:0 0 18px rgba(246,195,92,.7),0 2px 8px rgba(0,0,0,.5);transition:transform .12s ease,background .12s;transform:translate(512px,330px)';
  document.body.appendChild(c);
  let x = 512, y = 330;
  addEventListener('mousemove', e => { x = e.clientX; y = e.clientY; c.style.transform = `translate(${x}px,${y}px)`; }, true);
  addEventListener('mousedown', () => {
    c.style.transform = `translate(${x}px,${y}px) scale(.7)`; c.style.background = 'rgba(246,195,92,.7)';
    const r = document.createElement('div');
    r.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;border:2px solid rgba(246,195,92,.9);z-index:2147483646;pointer-events:none;transition:transform .55s ease-out,opacity .55s ease-out`;
    document.body.appendChild(r); requestAnimationFrame(() => { r.style.transform = 'scale(7)'; r.style.opacity = '0'; }); setTimeout(() => r.remove(), 700);
  }, true);
  addEventListener('mouseup', () => { c.style.transform = `translate(${x}px,${y}px)`; c.style.background = 'rgba(246,195,92,.28)'; }, true);
};

async function smoothScroll(page, to, ms){
  await page.evaluate(async ([to, ms]) => {
    const from = scrollY, t0 = performance.now();
    await new Promise(res => { const f = () => { const k = Math.min(1, (performance.now() - t0) / ms); const e = k < .5 ? 2*k*k : 1 - Math.pow(-2*k + 2, 2) / 2;
      scrollTo({ top: from + (to - from) * e, behavior: 'instant' }); if(k < 1) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  }, [to, ms]);
}
async function moveTo(page, sel, steps = 14, nth = 0){
  const el = page.locator(sel).nth(nth);
  await el.scrollIntoViewIfNeeded().catch(() => {});
  const b = await el.boundingBox();
  if(!b) throw new Error('kein Element: ' + sel);
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps });
  return b;
}
async function clickOn(page, sel, nth = 0, steps = 14){ await moveTo(page, sel, steps, nth); await page.waitForTimeout(160); await page.mouse.down(); await page.waitForTimeout(90); await page.mouse.up(); }
const wait = (page, ms) => page.waitForTimeout(ms);

const GRAMMAR = {
  title: 'Das passé composé – die Vergangenheit',
  rules: [
    'Gebildet aus avoir oder être im Präsens und dem Partizip Perfekt (participe passé).',
    'Die meisten Verben nehmen avoir: j\'ai mangé, tu as fini, nous avons vu.',
    'Viele Verben der Bewegung und alle reflexiven Verben nehmen être: je suis allé(e), elle s\'est levée.',
    'Mit être richtet sich das Partizip nach dem Subjekt: elles sont parties.',
  ],
  examples: [
    'Hier, j\'ai mangé une crêpe. — Gestern habe ich einen Crêpe gegessen.',
    'Nous sommes allés à Paris. — Wir sind nach Paris gefahren.',
    'Elle s\'est réveillée tôt. — Sie ist früh aufgewacht.',
    'Ils ont vu la tour Eiffel. — Sie haben den Eiffelturm gesehen.',
  ],
  exceptions: [
    'Unregelmäßige Partizipien lernen: faire → fait, prendre → pris, voir → vu, être → été.',
    'Mit avoir richtet sich das Partizip nach einem vorangestellten direkten Objekt: la lettre que j\'ai écrite.',
  ],
};

const PREP = { lernsets: 'home', aussprache: 'listen', grammatik: 'grammar', belohnungen: 'rewards', kalender: 'calendar', app: 'appDownload', ueberuns: 'about' };
const CLIPS = {
  lernsets: async (page) => {
    await page.evaluate(() => { goToDestination('home'); scrollTo(0, 0); });
    await wait(page, 900);
    await clickOn(page, '.set-card', 0);
    await wait(page, 1100);
    await smoothScroll(page, 420, 1500);
    await wait(page, 300);
    await clickOn(page, '#btnGoPractice');
    await wait(page, 900);
    await clickOn(page, '#modeOptions .chip >> text=/Multiple/'); await wait(page, 350);
    await clickOn(page, '#btnStartSession');
    await wait(page, 900);
    for(let i = 0; i < 3; i++){
      if(await page.locator('#btnRevealFlashcard').isVisible()){ await clickOn(page, '#btnRevealFlashcard'); await wait(page, 800); await clickOn(page, '#btnFlashKnew'); await wait(page, 900); }
      else if(await page.locator('#practiceOptions button').first().isVisible()){
        const idx = await page.evaluate(() => {
          const w = document.getElementById('practiceWord').textContent.trim();
          const set = store.sets.find(s => s.id === 's1');
          const p = set.pairs.find(p => p.de === w || p.fr === w);
          const ans = p ? (p.de === w ? p.fr : p.de) : '';
          return [...document.querySelectorAll('#practiceOptions button')].findIndex(b => b.textContent.trim() === ans);
        });
        await clickOn(page, '#practiceOptions button', Math.max(0, idx)); await wait(page, 1200);
        if(await page.locator('#btnNextQuestion').isVisible()){ await clickOn(page, '#btnNextQuestion'); await wait(page, 700); }
      }
    }
  },
  aussprache: async (page) => {
    await page.evaluate(() => { goToDestination('listen'); scrollTo(0, 0); });
    await wait(page, 800);
    await smoothScroll(page, 260, 1100);
    await clickOn(page, '#view-listen .speak-btn', 1); await wait(page, 900);
    await clickOn(page, '#view-listen .speak-btn', 3); await wait(page, 900);
    await smoothScroll(page, 700, 1600);
    await clickOn(page, '#view-listen .speak-btn', 9); await wait(page, 1000);
    await clickOn(page, '#view-listen .speak-btn', 8); await wait(page, 900);
  },
  grammatik: async (page) => {
    await page.evaluate((G) => { window.generateGrammarExplanation = async () => { await new Promise(r => setTimeout(r, 1100)); return G; }; goToDestination('grammar'); scrollTo(0, 0); }, GRAMMAR);
    await wait(page, 800);
    await clickOn(page, '#grammarExamples .chip', 0);
    await wait(page, 2200);
    await smoothScroll(page, 520, 2000);
    await wait(page, 500);
    await smoothScroll(page, 980, 1800);
    await wait(page, 700);
  },
  belohnungen: async (page) => {
    await page.evaluate(() => { goToDestination('rewards'); scrollTo(0, 0); });
    await wait(page, 900);
    if(await page.locator('#btnClaimDaily').isEnabled()) { await clickOn(page, '#btnClaimDaily'); await wait(page, 1300); }
    await smoothScroll(page, 700, 1800);
    await moveTo(page, '.arcade-card', 30, 1); await wait(page, 500);
    await moveTo(page, '.arcade-card', 26, 5); await wait(page, 500);
    await smoothScroll(page, 1500, 1800);
    await clickOn(page, '.lb-tabs .chip', 2); await wait(page, 900);
  },
  kalender: async (page) => {
    await page.evaluate(() => { goToDestination('calendar'); scrollTo(0, 0); });
    await wait(page, 900);
    const d = new Date(); d.setDate(d.getDate() + 5);
    await clickOn(page, `.cal-day.has-event, .cal-day`, await page.evaluate(() => { const all = [...document.querySelectorAll('.cal-day')]; const i = all.findIndex(x => x.classList.contains('has-event') || x.querySelector('.cal-event, .cal-dot')); return Math.max(0, i); }));
    await wait(page, 1300);
    await page.keyboard.press('Escape'); await wait(page, 600);
    await clickOn(page, '.chip >> text=Woche'); await wait(page, 1100);
    await clickOn(page, '.chip >> text=Monat'); await wait(page, 700);
    await smoothScroll(page, 600, 1800); await wait(page, 700);
  },
  app: async (page) => {
    await page.evaluate(() => { goToDestination('appDownload'); scrollTo(0, 0); });
    await wait(page, 900);
    await smoothScroll(page, 520, 1500);
    await clickOn(page, '.chip >> text=/Android/'); await wait(page, 1000);
    await clickOn(page, '.chip >> text=/Desktop/'); await wait(page, 1000);
    await clickOn(page, '.chip >> text=/iOS/'); await wait(page, 800);
    await smoothScroll(page, 1300, 2000); await wait(page, 600);
  },
  ueberuns: async (page) => {
    await page.evaluate(() => { goToDestination('about'); scrollTo(0, 0); });
    await wait(page, 900);
    await page.mouse.move(900, 420, { steps: 20 });
    await smoothScroll(page, 700, 2600); await wait(page, 400);
    await smoothScroll(page, 1400, 2600); await wait(page, 600);
  },
};

async function record(name){
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  if(process.env.SUPABASE_UMD) await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', r => r.fulfill({ path: process.env.SUPABASE_UMD, contentType: 'application/javascript' }));
  await page.route('https://imjlrfemiptuwobliydq.supabase.co/**', r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }));
  await page.goto('http://localhost:8097/', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  await seed(page);
  await page.evaluate(CURSOR);
  await page.evaluate(() => { try{ soundEnabled = false; }catch(e){} });
  await page.evaluate((d) => { goToDestination(d); scrollTo(0, 0); }, PREP[name]);
  await page.waitForTimeout(1500);
  // Warmlaufen: erste Seite einmal zeigen, dann aufnehmen
  const dir = OUT + name + '/'; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const client = await ctx.newCDPSession(page);
  const frames = [];
  client.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    frames.push({ t: metadata.timestamp, file: dir + String(frames.length).padStart(5, '0') + '.jpg' });
    fs.writeFileSync(frames[frames.length - 1].file, Buffer.from(data, 'base64'));
    try{ await client.send('Page.screencastFrameAck', { sessionId }); }catch(e){}
  });
  await client.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: Math.round(W * DPR), maxHeight: Math.round(H * DPR), everyNthFrame: 1 });
  const t0 = Date.now() / 1000;
  await CLIPS[name](page);
  await page.waitForTimeout(300);
  await client.send('Page.stopScreencast');
  const tEnd = Date.now() / 1000;
  await browser.close();
  // Zeitstempel -> concat-Liste mit Dauer je Bild
  const list = frames.map((f, i) => `file '${f.file}'\nduration ${Math.max(0.01, ((frames[i + 1] ? frames[i + 1].t : tEnd) - f.t)).toFixed(4)}`).join('\n') + `\nfile '${frames[frames.length - 1].file}'\n`;
  fs.writeFileSync(dir + 'list.txt', list);
  const raw = OUT + name + '-raw.mp4';
  execFileSync(FF, ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', dir + 'list.txt', '-vf', 'setpts=PTS/1.5,fps=25,scale=1120:700:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-crf', '14', '-preset', 'fast', raw]);
  console.log(name, 'frames', frames.length, 'secs', (tEnd - t0).toFixed(1), 'errors', errors);
}
(async () => {
  for (const n of Object.keys(CLIPS)) if (ONLY === 'all' || ONLY === n) await record(n);
})();
