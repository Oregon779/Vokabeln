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
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, Points, Clock,
  TorusGeometry, TubeGeometry, ExtrudeGeometry, Shape, CatmullRomCurve3,
  BufferGeometry, Float32BufferAttribute, Box3,
  MeshPhysicalMaterial, MeshStandardMaterial, PointsMaterial,
  Color, Vector3, CanvasTexture, EquirectangularReflectionMapping,
  PMREMGenerator, PointLight, AmbientLight,
  ACESFilmicToneMapping, SRGBColorSpace, AdditiveBlending,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const GOLD        = 0xf0a92c;   // kraeftiger als das Seiten-Gold: das Emblem
const GOLD_BRIGHT = 0xffc94a;   // und der Turm sollen leuchten, nicht nur
const CHAMPAGNE   = 0xfff0c4;   // vorhanden sein
const AMBER_DEEP  = 0xb35c06;
const NIGHT_BLUE  = 0x18243f;   // das Blau der Seite als Gegenlicht

// Die Umgebung, in der sich das Glas spiegelt. Statt eine HDR-Datei zu laden
// wird sie hier gezeichnet: dunkler Grund, ein warmer Lichtbogen oben, ein
// Weinrot-Schimmer als Gegenlicht unten. Das gibt der Brechung etwas zu
// brechen und liefert gleichzeitig die satte Wärme, die die Seite haben soll.
function makeEnvTexture(){
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.00, '#0b1220');
  grad.addColorStop(0.24, '#b87c12');
  grad.addColorStop(0.40, '#ffd257');
  grad.addColorStop(0.55, '#6b4409');
  grad.addColorStop(0.74, '#16233c');
  grad.addColorStop(1.00, '#070a12');
  g.fillStyle = grad; g.fillRect(0, 0, 512, 256);
  // Einzelne Lichtquellen, damit die Kanten echte Glanzpunkte bekommen.
  const lamps = [
    [110,  60,  98, 'rgba(255,240,190,.85)'],
    [352,  44,  80, 'rgba(255,205,100,.70)'],
    [246, 178, 130, 'rgba(40,70,130,.42)'],
    [452, 146,  92, 'rgba(255,160,50,.38)'],
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
  // Ein Monolinien-L: gleichmaessig duenner Strich statt Blockserife. Der
  // Umriss IST die Linie - Stamm und Fuss sind nur 0.115 breit.
  const w = 0.115;
  const s = new Shape();
  s.moveTo(-0.30, -0.52);
  s.lineTo( 0.30, -0.52);
  s.lineTo( 0.30, -0.52 + w);
  s.lineTo(-0.30 + w, -0.52 + w);
  s.lineTo(-0.30 + w,  0.52);
  s.lineTo(-0.30,      0.52);
  s.closePath();
  const geo = new ExtrudeGeometry(s, {
    depth: 0.085, bevelEnabled: true, bevelThickness: 0.016,
    bevelSize: 0.014, bevelSegments: 2, curveSegments: 3,
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
    g.add(new Mesh(new TubeGeometry(curve, lite ? 20 : 48, 0.032, lite ? 5 : 8, false), mat));
  }
  return g;
}

/* ----------------------------------------------------------------- Turm  */

// Der Eiffelturm kommt als Modell (tower.glb, Johnson Martin, CC-BY-4.0) und
// wird erst geholt, wenn man sich seiner Szene naehert - der erste
// Seitenaufruf soll davon nichts merken.
const TOWER_HEIGHT = 10;        // Zielhoehe in Weltmassen, das Modell wird skaliert
let towerLoading = false;

function applyTowerLook(root, lite){
  // Das Modell bringt eigene, matte Materialien mit. Sie werden komplett
  // ersetzt: poliertes Gold, das von innen glimmt.
  const mat = new MeshStandardMaterial({
    color: GOLD, emissive: new Color(AMBER_DEEP), emissiveIntensity: 0.42,
    metalness: 0.94, roughness: 0.34, envMapIntensity: 1.55, transparent: true,
  });
  root.traverse(o => {
    if(o.isMesh){
      if(o.material && o.material.dispose) o.material.dispose();
      o.material = mat;
      o.castShadow = o.receiveShadow = false;
      o.frustumCulled = true;
    }
  });
  return mat;
}

// Das Funkeln: Punkte im Volumen des Turms, die im Wechsel aufblitzen -
// das stuendliche Lichtspiel, nur ruhiger.
function makeSparks(height, lite){
  const count = lite ? 200 : 520;
  const pos = new Float32Array(count * 3);
  for(let i = 0; i < count; i++){
    const h = Math.random();
    // Die Breite folgt grob dem Umriss, damit die Funken auf dem Bauwerk
    // sitzen und nicht daneben in der Luft.
    const w = (0.34 * Math.pow(1 - h, 1.85) + 0.02) * height * (0.4 + Math.random() * 0.9);
    const a = Math.random() * Math.PI * 2;
    pos[i * 3]     = Math.cos(a) * w;
    pos[i * 3 + 1] = h * height;
    pos[i * 3 + 2] = Math.sin(a) * w;
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  return new Points(geo, new PointsMaterial({
    color: CHAMPAGNE, size: lite ? 0.075 : 0.05, transparent: true,
    opacity: 0, blending: AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }));
}

function loadTower(url){
  if(tower || towerLoading || !ready) return;
  towerLoading = true;
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load(url, gltf => {
    const model = gltf.scene;
    const mat = applyTowerLook(model, lite);

    // Auf eine feste Hoehe bringen und den Fuss auf y=0 setzen, damit die
    // Kamerafahrt mit festen Zahlen rechnen kann.
    const box = new Box3().setFromObject(model);
    const size = box.getSize(new Vector3());
    const k = TOWER_HEIGHT / (size.y || 1);
    model.scale.setScalar(k);
    model.position.set(-((box.min.x + box.max.x) / 2) * k, -box.min.y * k,
                       -((box.min.z + box.max.z) / 2) * k);

    const g = new Group();
    g.add(model);
    const sparks = makeSparks(TOWER_HEIGHT, lite);
    g.add(sparks);
    g.visible = false;
    scene.add(g);
    tower = g;
    towerMats = [mat, sparks.material];
    tower.userData.sparks = sparks;
    towerLoading = false;
  }, undefined, err => {
    console.warn('Turm-Modell konnte nicht geladen werden:', err);
    towerLoading = false;
  });
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
let towerAmt = 0, towerShown = 0, tourP = 0, tourShown = 0;
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
  renderer.toneMappingExposure = 1.12;
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
        transmission: 1, thickness: 0.10, ior: 1.42,
        attenuationColor: new Color(0xb2660b), attenuationDistance: 0.028,
        emissive: new Color(GOLD), emissiveIntensity: 0.55,
        specularColor: new Color(CHAMPAGNE), specularIntensity: 1,
        // Kraeftiges Irisieren: beim Drehen wandert ein Schimmer ueber die
        // Kante, wie das verchromte Zeichen in der Referenz.
        iridescence: 0.92, iridescenceIOR: 1.38, iridescenceThicknessRange: [180, 760],
        clearcoat: 1, clearcoatRoughness: 0.03,
        envMapIntensity: 2.3, transparent: true,
      });

  const mainMat = glass();
  ringMain = new Mesh(new TorusGeometry(1.9, 0.052, lite ? 12 : 28, lite ? 90 : 260), mainMat);
  emblem.add(ringMain);

  // Das L sitzt als eigener, etwas dickerer Körper mittig im Ring.
  const letterMat = new MeshStandardMaterial({
    color: GOLD_BRIGHT, emissive: new Color(GOLD), emissiveIntensity: 0.7,
    metalness: 1, roughness: 0.14, envMapIntensity: 2.4, transparent: true,
  });
  const letter = makeLetterL(letterMat);
  letter.scale.setScalar(1.85);
  emblem.add(letter);
  emblem.userData.letter = letter;

  const ribbonMat = glass();
  emblem.add(makeRibbon(ribbonMat, lite));

  // Ein dünner, heller Reif - er zeichnet die Silhouette nach, damit der Ring
  // auch vor sehr dunklem Grund eine Kante behält.
  emblemMats = [mainMat, letterMat, ribbonMat];

  /* --- Licht: warm von oben, Weinrot als Gegenlicht von unten -----------
     Die Reichweite muss den Turm mit abdecken (10 Einheiten hoch), deshalb
     stehen die Lampen weiter draussen als fuer das Emblem noetig waere. */
  scene.add(new AmbientLight(0xffe2ad, 0.6));
  const key  = new PointLight(GOLD_BRIGHT, 260, 90); key.position.set(9, 14, 12);   scene.add(key);
  const rim  = new PointLight(CHAMPAGNE,   120, 90); rim.position.set(-11, 3, 6);   scene.add(rim);
  const back = new PointLight(NIGHT_BLUE,  260, 90); back.position.set(-7, -6, -10); scene.add(back);
  const warm = new PointLight(AMBER_DEEP,  200, 90); warm.position.set(11, 1, -7);  scene.add(warm);

  clock = new Clock();
  resize();
  ready = true;
  return true;
}

// Der Scroll-Fortschritt (0 = ganz oben, 1 = am Ende der Startseite) steuert
// das Emblem. setTower() blendet davon unabhängig den Turm ein: 0 = Emblem
// spielt, 1 = der Turm hat die Bühne.
function setProgress(p){ progress = Math.max(0, Math.min(1, p)); }
// `amount` blendet den Turm ein (0 = Emblem spielt, 1 = Turm hat die Buehne),
// `p` ist der Fortschritt innerhalb der Turm-Szene und fuehrt die Kamera.
function setTower(amount, p){
  towerAmt = Math.max(0, Math.min(1, amount));
  if(typeof p === 'number') tourP = Math.max(0, Math.min(1, p));
}
function setPointer(nx, ny){ pointerX = nx; pointerY = ny; }

/* Die Fahrt um den Turm: oben an der Spitze los, eine halbe Umrundung nach
   rechts und dabei hinunter zum Fuss. Zwei Stuetzstellen reichen - Winkel,
   Hoehe, Abstand und Blickpunkt werden dazwischen weich interpoliert. */
const TOUR = {
  from: { ang: -0.45,             y: 9.2, dist: 7.2, look: 8.4 },  // an der Spitze
  to:   { ang: Math.PI - 0.45,    y: 2.1, dist: 9.4, look: 2.6 },  // am Fuss
};
const _camTour = new Vector3(), _lookTour = new Vector3(), _look = new Vector3();
function tourCamera(q){
  const e = smoothstep(q);
  const ang  = TOUR.from.ang  + (TOUR.to.ang  - TOUR.from.ang)  * e;
  const y    = TOUR.from.y    + (TOUR.to.y    - TOUR.from.y)    * e;
  const dist = TOUR.from.dist + (TOUR.to.dist - TOUR.from.dist) * e;
  const look = TOUR.from.look + (TOUR.to.look - TOUR.from.look) * e;
  _camTour.set(Math.sin(ang) * dist, y, Math.cos(ang) * dist);
  _lookTour.set(0, look, 0);
}

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

  if(tower){
    tower.visible = tw > 0.01;
    if(tower.visible){
      // Auf einem hochkantigen Schirm faellt der Turm schmaler aus, sonst
      // passt er nicht zwischen Kopfleiste und Kaertchen.
      tower.scale.setScalar(fit);
      tower.position.set(0, -TOWER_HEIGHT * 0.5 * fit, 0);
      tower.rotation.y = px * 0.06;   // nur ein Hauch Zeiger-Reaktion
      const app = smoothstep(Math.min(1, tw * 1.6));
      for(const m of towerMats) m.opacity = app;
      // Funkeln: ein ruhiges Pulsieren, kein Stroboskop.
      tower.userData.sparks.material.opacity =
        (0.3 + 0.6 * (0.5 + 0.5 * Math.sin(t * 2.1))) * app;
    }
  }

  // Die Kamera: waehrend der Turm-Szene faehrt sie um ihn herum, sonst steht
  // sie vor dem Emblem. Dazwischen wird ueberblendet, damit nichts springt.
  tourCamera(tourShown);
  const yOff = -TOWER_HEIGHT * 0.5 * fit;
  const ez = 7 - p * 1.2;
  const b = smoothstep(tw);
  camera.position.set(_camTour.x * b,
                      (_camTour.y + yOff) * b,
                      ez + (_camTour.z - ez) * b);
  _look.set(0, (_lookTour.y + yOff) * b, 0);
  camera.lookAt(_look);
}

function frame(){
  if(!running){ raf = 0; return; }
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  shown      += (progress - shown)     * Math.min(1, dt * 3.2);
  towerShown += (towerAmt - towerShown) * Math.min(1, dt * 3.6);
  tourShown  += (tourP    - tourShown)  * Math.min(1, dt * 3.4);
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
  shown = progress; towerShown = towerAmt; tourShown = tourP; px = pointerX; py = pointerY;
  applyTransform(shown, 0);
  renderer.render(scene, camera);
}

window.LumiereGL = { init, start, stop, resize, setProgress, setTower, setPointer,
  renderOnce, loadTower,
  get ready(){ return ready; },
  get hasTower(){ return !!tower; } };
