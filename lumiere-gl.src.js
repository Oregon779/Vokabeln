// Lumière — die 3D-Ebene der Startseite.
//
// Zwei Auftritte in einer Szene, die der Scroll gegeneinander ueberblendet:
//   1. das Emblem  - gläserner Goldring, das L als eigener Körper darin,
//                    darunter eine Schlaufe aus zwei sich kreuzenden Bändern
//   2. der Turm    - der Eiffelturm als goldenes Gitterwerk, von innen
//                    beleuchtet, mit wanderndem Funkeln
// Nach aussen gibt es nur window.LumiereGL. Die Seite selbst weiss nichts
// von Three.js.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, InstancedMesh, Points,
  Clock, Object3D, Matrix4, Euler, Quaternion,
  TorusGeometry, BoxGeometry, CylinderGeometry, ConeGeometry, TubeGeometry,
  ExtrudeGeometry, Shape, CatmullRomCurve3, BufferGeometry, Float32BufferAttribute,
  MeshPhysicalMaterial, MeshStandardMaterial, PointsMaterial,
  Color, Vector3, CanvasTexture, EquirectangularReflectionMapping,
  PMREMGenerator, PointLight, AmbientLight,
  ACESFilmicToneMapping, SRGBColorSpace, AdditiveBlending,
} from 'three';

const GOLD        = 0xd9a548;
const GOLD_BRIGHT = 0xf6c35c;
const CHAMPAGNE   = 0xf3e2b8;
const AMBER_DEEP  = 0x8c4a12;
const WINE        = 0x6d1f28;

// Die Umgebung, in der sich das Glas spiegelt. Statt eine HDR-Datei zu laden
// wird sie hier gezeichnet: dunkler Grund, ein warmer Lichtbogen oben, ein
// Weinrot-Schimmer als Gegenlicht unten. Das gibt der Brechung etwas zu
// brechen und liefert gleichzeitig die satte Wärme, die die Seite haben soll.
function makeEnvTexture(){
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.00, '#1a1205');
  grad.addColorStop(0.26, '#9c6f24');
  grad.addColorStop(0.42, '#ffd777');
  grad.addColorStop(0.56, '#5a3312');
  grad.addColorStop(0.78, '#3d121c');
  grad.addColorStop(1.00, '#08070c');
  g.fillStyle = grad; g.fillRect(0, 0, 512, 256);
  // Einzelne Lichtquellen, damit die Kanten echte Glanzpunkte bekommen.
  const lamps = [
    [110,  62,  95, 'rgba(255,238,196,.70)'],
    [352,  48,  76, 'rgba(255,214,140,.55)'],
    [246, 176, 130, 'rgba(190,60,72,.30)'],
    [452, 150,  90, 'rgba(255,170,90,.30)'],
  ];
  for(const [x, y, r, col] of lamps){
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, col);
    rg.addColorStop(1, col.replace(/[\d.]+\)$/, '0)'));
    g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const tex = new CanvasTexture(c);
  tex.mapping = EquirectangularReflectionMapping;
  return tex;
}

/* ---------------------------------------------------------------- Emblem */

// Das L als eigener Körper: ein Schriftzug liesse sich nur mit einer
// Schriftdatei bauen, deshalb ist es hier als Umriss gezeichnet und
// extrudiert - ein Blockserifen-L, das im Ring als Monogramm liest.
function makeLetterL(mat){
  const s = new Shape();
  s.moveTo(-0.33, -0.50);
  s.lineTo( 0.33, -0.50);
  s.lineTo( 0.33, -0.28);
  s.lineTo(-0.11, -0.28);
  s.lineTo(-0.11,  0.50);
  s.lineTo(-0.33,  0.50);
  s.closePath();
  const geo = new ExtrudeGeometry(s, {
    depth: 0.26, bevelEnabled: true, bevelThickness: 0.045,
    bevelSize: 0.04, bevelSegments: 3, curveSegments: 4,
  });
  geo.center();
  return new Mesh(geo, mat);
}

// Die zwei Bänder, die unter dem Ring hängen und sich kreuzen.
function makeRibbon(mat, lite){
  const g = new Group();
  const arcs = [
    [[-0.58, -1.86, 0], [-1.20, -2.75, 0.16], [ 0.72, -3.85, 0]],
    [[ 0.58, -1.86, 0], [ 1.20, -2.75, -0.16], [-0.72, -3.85, 0]],
  ];
  for(const pts of arcs){
    const curve = new CatmullRomCurve3(pts.map(p => new Vector3(...p)));
    g.add(new Mesh(new TubeGeometry(curve, lite ? 20 : 48, 0.055, lite ? 5 : 8, false), mat));
  }
  return g;
}

/* ----------------------------------------------------------------- Turm  */

// Der Umriss des Eiffelturms: die halbe Breite über die Höhe. Die Kurve ist
// nicht gemessen, sondern so gewählt, dass die Silhouette stimmt - genau die
// trägt das Wiedererkennen, nicht die Zahl der Streben.
function towerHalfWidth(h){
  return 0.50 * Math.pow(1 - Math.min(h, 1), 1.85) + 0.030;
}

function buildTower(matFrame, matGlow, lite){
  const g = new Group();
  const H = 7.2;                       // Gesamthöhe in Weltmaßen
  const SEG = lite ? 22 : 40;

  // Vier Eckpfeiler. Alle haben denselben Verlauf, nur um 90° gedreht -
  // deshalb wird die Kurve einmal gebaut und viermal verwendet.
  const postPts = [];
  for(let i = 0; i <= SEG; i++){
    const h = i / SEG;
    const w = towerHalfWidth(h);
    postPts.push(new Vector3(w, h * H, w));
  }
  const postGeo = new TubeGeometry(new CatmullRomCurve3(postPts), SEG, 0.032, lite ? 4 : 7, false);
  for(let i = 0; i < 4; i++){
    const m = new Mesh(postGeo, matFrame);
    m.rotation.y = i * Math.PI / 2;
    g.add(m);
  }

  // Gitterwerk: waagerechte Ringe und dazwischen gekreuzte Streben. Alles in
  // einem einzigen InstancedMesh, sonst wären es hunderte Zeichenaufrufe.
  const dummy = new Object3D();
  const bars = [];
  const levels = lite ? 13 : 24;
  for(let i = 0; i < levels; i++){
    const h0 = i / levels, h1 = (i + 1) / levels;
    const w0 = towerHalfWidth(h0), w1 = towerHalfWidth(h1);
    const y0 = h0 * H, y1 = h1 * H;
    for(let f = 0; f < 4; f++){
      const rot = f * Math.PI / 2;
      // waagerechte Strebe am unteren Rand des Feldes
      bars.push({ a: cornerAt(w0, y0, rot), b: cornerAt(w0, y0, rot + Math.PI / 2), r: 0.013 });
      // zwei Diagonalen, die sich in der Feldmitte kreuzen
      bars.push({ a: cornerAt(w0, y0, rot), b: cornerAt(w1, y1, rot + Math.PI / 2), r: 0.010 });
      bars.push({ a: cornerAt(w0, y0, rot + Math.PI / 2), b: cornerAt(w1, y1, rot), r: 0.010 });
    }
  }
  const lattice = new InstancedMesh(new BoxGeometry(1, 1, 1), matFrame, bars.length);
  const up = new Vector3(0, 1, 0), dir = new Vector3(), mid = new Vector3();
  const quat = new Quaternion();
  bars.forEach((bar, i) => {
    dir.subVectors(bar.b, bar.a);
    const len = dir.length();
    mid.addVectors(bar.a, bar.b).multiplyScalar(0.5);
    quat.setFromUnitVectors(up, dir.normalize());
    dummy.position.copy(mid);
    dummy.quaternion.copy(quat);
    dummy.scale.set(bar.r, len, bar.r);
    dummy.updateMatrix();
    lattice.setMatrixAt(i, dummy.matrix);
  });
  lattice.instanceMatrix.needsUpdate = true;
  g.add(lattice);

  // Die Bogen unter der ersten Plattform - sie tragen die Silhouette
  // genauso wie die Pfeiler.
  for(let f = 0; f < 4; f++){
    const rot = f * Math.PI / 2;
    const a = cornerAt(towerHalfWidth(0), 0, rot);
    const b = cornerAt(towerHalfWidth(0), 0, rot + Math.PI / 2);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    mid.y = H * 0.125;
    mid.multiplyScalar(0.84); mid.y = H * 0.125;
    const arc = new CatmullRomCurve3([a, mid, b]);
    g.add(new Mesh(new TubeGeometry(arc, lite ? 10 : 22, 0.018, lite ? 4 : 6, false), matFrame));
  }

  // Die drei Plattformen als flache Rahmen.
  for(const [h, thick] of [[0.155, 0.055], [0.345, 0.045], [0.80, 0.038]]){
    const w = towerHalfWidth(h) * 1.5;
    const p = new Mesh(new BoxGeometry(w * 2, thick, w * 2), matFrame);
    p.position.y = h * H;
    g.add(p);
  }

  // Die Spitze mit der Antenne.
  const spire = new Mesh(new ConeGeometry(towerHalfWidth(0.94) * 1.1, H * 0.09, lite ? 6 : 10), matFrame);
  spire.position.y = H * 0.975;
  g.add(spire);
  const mast = new Mesh(new CylinderGeometry(0.012, 0.016, H * 0.10, 6), matGlow);
  mast.position.y = H * 1.06;
  g.add(mast);

  // Das Funkeln: Punkte entlang der Silhouette, die im Wechsel aufblitzen -
  // das stündliche Lichtspiel, nur ruhiger.
  const count = lite ? 160 : 420;
  const pos = new Float32Array(count * 3);
  for(let i = 0; i < count; i++){
    const h = Math.random();
    const w = towerHalfWidth(h) * (0.55 + Math.random() * 0.75);
    const a = Math.random() * Math.PI * 2;
    pos[i * 3]     = Math.cos(a) * w;
    pos[i * 3 + 1] = h * H;
    pos[i * 3 + 2] = Math.sin(a) * w;
  }
  const sparkGeo = new BufferGeometry();
  sparkGeo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  const sparks = new Points(sparkGeo, new PointsMaterial({
    color: CHAMPAGNE, size: lite ? 0.048 : 0.032, transparent: true,
    opacity: 0.9, blending: AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }));
  g.add(sparks);

  // Innen wird der Turm um seine eigene Mitte zentriert, aussen wird er
  // bewegt. Zwei Gruppen, damit sich beides nicht ins Gehege kommt.
  g.position.y = -H * 0.5;
  const outer = new Group();
  outer.add(g);
  outer.userData.sparks = sparks;
  return outer;
}
function cornerAt(w, y, rot){
  return new Vector3(Math.cos(rot) * w * Math.SQRT2 * 0.7071, y, Math.sin(rot) * w * Math.SQRT2 * 0.7071);
}

/* --------------------------------------------------------------- Ablauf  */

// Die Reise des Emblems, als Tabelle statt als Trigonometrie: pro Stützstelle
// der Scroll-Fortschritt und wo der Ring dann steht. Dazwischen wird weich
// interpoliert. So lässt sich jede Szene einzeln nachjustieren, ohne dass
// eine Sinuskurve alle anderen mitverbiegt.
//        p     scale     x      y      z     rotX   rotY   rotZ
const KEYS = [
  [0.00, 0.28,  0.00,  1.28,  0.00,  0.16,  0.00,  0.00],  // Eintritt - klein, über der Wortmarke
  [0.20, 0.72,  1.25, -0.10, -0.20,  0.40,  0.85,  0.14],  // Das Wort - wandert nach rechts
  [0.40, 1.22, -0.70,  0.06,  0.70,  0.70,  1.75, -0.28],  // Methode  - gross, gekippt, vorn
  [0.62, 0.70,  0.00,  0.00, -4.00,  0.50,  2.60,  0.10],  // Turm      - Emblem tritt ab
  [0.82, 0.86, -1.45,  0.20, -1.20,  0.46,  3.30,  0.18],  // Atelier   - links, Inhalt steht rechts
  [1.00, 0.28,  0.00,  1.35, -0.15,  0.22,  4.20,  0.00],  // Abschluss - wieder klein, über dem Satz
];
function smoothstep(t){ return t * t * (3 - 2 * t); }
function sampleKeys(p, out){
  let i = 0;
  while(i < KEYS.length - 2 && p > KEYS[i + 1][0]) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const t = smoothstep(Math.max(0, Math.min(1, (p - a[0]) / (b[0] - a[0]))));
  for(let k = 1; k < 8; k++) out[k - 1] = a[k] + (b[k] - a[k]) * t;
  return out;
}

let renderer, scene, camera, clock;
let emblem, ringMain, tower, towerMats = [], emblemMats = [];
let raf = 0, running = false, lite = false, ready = false;
let progress = 0, shown = 0;
let towerAmt = 0, towerShown = 0;
let pointerX = 0, pointerY = 0, px = 0, py = 0;

function init(canvas, opts){
  if(ready) return true;
  opts = opts || {};
  lite = !!opts.lite;
  try{
    renderer = new WebGLRenderer({ canvas, antialias: !lite, alpha: true, powerPreference: lite ? 'low-power' : 'high-performance' });
  }catch(e){ return false; }
  if(!renderer.getContext()) return false;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lite ? 1.5 : 2));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.outputColorSpace = SRGBColorSpace;

  scene = new Scene();
  camera = new PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0, 7);

  const envTex = makeEnvTexture();
  // Auf schwachen Geräten kostet PMREM spürbar - dort reicht die Textur roh.
  if(lite){
    scene.environment = envTex;
  }else{
    const pmrem = new PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(envTex).texture;
    pmrem.dispose(); envTex.dispose();
  }

  /* --- Emblem ----------------------------------------------------------- */
  emblem = new Group();
  scene.add(emblem);

  // Auf dem Desktop echtes Glas mit Brechung, auf schwachen Geräten
  // poliertes Metall - optisch verwandt, aber ohne Extra-Renderpass.
  const glass = () => lite
    ? new MeshStandardMaterial({ color: GOLD, metalness: 1, roughness: 0.16, envMapIntensity: 1.7, transparent: true })
    : new MeshPhysicalMaterial({
        color: 0xffffff, metalness: 0, roughness: 0.055,
        transmission: 1, thickness: 0.20, ior: 1.47,
        attenuationColor: new Color(0x8f4e0c), attenuationDistance: 0.16,
        specularColor: new Color(CHAMPAGNE), specularIntensity: 1,
        iridescence: 0.25, iridescenceIOR: 1.30, iridescenceThicknessRange: [140, 420],
        clearcoat: 1, clearcoatRoughness: 0.04,
        envMapIntensity: 1.7, transparent: true,
      });

  const mainMat = glass();
  ringMain = new Mesh(new TorusGeometry(1.9, 0.135, lite ? 14 : 36, lite ? 72 : 220), mainMat);
  emblem.add(ringMain);

  // Das L sitzt als eigener, etwas dickerer Körper mittig im Ring.
  const letterMat = glass();
  if(letterMat.thickness !== undefined){ letterMat.thickness = 0.26; letterMat.attenuationDistance = 0.95; letterMat.iridescence = 0.45; }
  const letter = makeLetterL(letterMat);
  letter.scale.setScalar(1.95);
  emblem.add(letter);
  emblem.userData.letter = letter;

  const ribbonMat = glass();
  emblem.add(makeRibbon(ribbonMat, lite));

  // Ein dünner, heller Reif - er zeichnet die Silhouette nach, damit der Ring
  // auch vor sehr dunklem Grund eine Kante behält.
  emblemMats = [mainMat, letterMat, ribbonMat];

  /* --- Turm ------------------------------------------------------------- */
  const frameMat = new MeshStandardMaterial({
    color: GOLD, emissive: new Color(AMBER_DEEP), emissiveIntensity: 0.55,
    metalness: 0.95, roughness: 0.32, envMapIntensity: 1.6, transparent: true,
  });
  const glowMat = new MeshStandardMaterial({
    color: CHAMPAGNE, emissive: new Color(GOLD_BRIGHT), emissiveIntensity: 2.4,
    metalness: 1, roughness: 0.2, transparent: true,
  });
  tower = buildTower(frameMat, glowMat, lite);
  tower.visible = false;
  scene.add(tower);
  towerMats = [frameMat, glowMat, tower.userData.sparks.material];

  /* --- Licht: warm von oben, Weinrot als Gegenlicht von unten ----------- */
  scene.add(new AmbientLight(0xffe2ad, 0.55));
  const key  = new PointLight(GOLD_BRIGHT, 70, 40); key.position.set(4, 6, 6);   scene.add(key);
  const rim  = new PointLight(CHAMPAGNE,   30, 40); rim.position.set(-6, -2, 3); scene.add(rim);
  const back = new PointLight(WINE,        55, 40); back.position.set(-3, -6, -4); scene.add(back);
  const warm = new PointLight(AMBER_DEEP,  45, 40); warm.position.set(5, -4, -2); scene.add(warm);

  clock = new Clock();
  resize();
  ready = true;
  return true;
}

// Der Scroll-Fortschritt (0 = ganz oben, 1 = am Ende der Startseite) steuert
// das Emblem. setTower() blendet davon unabhängig den Turm ein: 0 = Emblem
// spielt, 1 = der Turm hat die Bühne.
function setProgress(p){ progress = Math.max(0, Math.min(1, p)); }
function setTower(t){ towerAmt = Math.max(0, Math.min(1, t)); }
function setPointer(nx, ny){ pointerX = nx; pointerY = ny; }

const _k = new Array(7);
function applyTransform(p, t){
  const k = sampleKeys(p, _k);
  // Die Kamera misst senkrecht. Auf einem hochkantigen Schirm würde der Ring
  // deshalb das ganze Bild füllen - dort fällt er entsprechend kleiner aus.
  const fit = Math.max(0.50, Math.min(1, camera.aspect / 1.35));
  emblem.scale.setScalar(k[0] * fit);
  emblem.position.set(k[1], k[2], k[3]);
  // Der Zeiger kippt das Emblem nur leicht mit - genug, dass es auf die Maus
  // reagiert, zu wenig, um die inszenierte Bahn zu überschreiben.
  emblem.rotation.set(k[4] + py * 0.16 + Math.sin(t * 0.25) * 0.04,
                      k[5] + px * 0.22,
                      k[6]);
  if(emblem.userData.letter) emblem.userData.letter.rotation.y = -k[5] * 0.5 + Math.sin(t * 0.35) * 0.06;
  camera.position.z = 7 - p * 1.2;

  // Überblendung. Der Turm steigt beim Auftritt leicht an und dreht sich
  // langsam, damit das Gitterwerk aus allen Richtungen Licht fängt.
  const tw = towerShown;
  const eo = 1 - smoothstep(Math.min(1, tw * 1.25));
  emblem.visible = eo > 0.01;
  for(const m of emblemMats) m.opacity = eo;

  tower.visible = tw > 0.01;
  if(tower.visible){
    const rise = smoothstep(tw);
    // Massstab so, dass der ganze Turm ins Bild passt - bei Kamera z=7 und
    // 42 Grad sind das rund 5.4 Welteinheiten Hoehe.
    tower.scale.setScalar((0.50 + rise * 0.16) * fit);
    // Hochkant liegt das Kaertchen ueber der Mitte des Turms. Dort rueckt er
    // nach oben, damit wenigstens die obere Haelfte frei steht.
    const portrait = camera.aspect < 0.95;
    tower.position.set(0, (portrait ? 1.20 : -0.25) + rise * 0.35, -0.8 - (1 - rise) * 5);
    tower.rotation.y = t * 0.09 + px * 0.28 + tw * 0.5;
    tower.rotation.x = py * 0.05;
    for(const m of towerMats) m.opacity = smoothstep(Math.min(1, tw * 1.6));
    // Funkeln: ein ruhiges Pulsieren, kein Stroboskop.
    const s = tower.userData.sparks.material;
    s.opacity = (0.35 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2.1))) * smoothstep(Math.min(1, tw * 1.6));
  }
}

function frame(){
  if(!running){ raf = 0; return; }
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  shown      += (progress  - shown)      * Math.min(1, dt * 3.2);
  towerShown += (towerAmt  - towerShown) * Math.min(1, dt * 3.6);
  px += (pointerX - px) * Math.min(1, dt * 2.4);
  py += (pointerY - py) * Math.min(1, dt * 2.4);
  applyTransform(shown, t);

  renderer.render(scene, camera);
  raf = requestAnimationFrame(frame);
}

function resize(){
  if(!ready) return;
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function start(){
  if(!ready || running) return;
  running = true;
  clock.start();
  if(!raf) raf = requestAnimationFrame(frame);
}
function stop(){
  running = false;
  if(raf){ cancelAnimationFrame(raf); raf = 0; }
}
// Ein einzelnes Standbild - für prefers-reduced-motion, wo nichts laufen darf.
function renderOnce(){
  if(!ready) return;
  shown = progress; towerShown = towerAmt; px = pointerX; py = pointerY;
  applyTransform(shown, 0);
  renderer.render(scene, camera);
}

window.LumiereGL = { init, start, stop, resize, setProgress, setTower, setPointer, renderOnce,
  get ready(){ return ready; } };
