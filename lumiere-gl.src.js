// Lumière — das Emblem in echtem 3D.
//
// Ein einziger gläserner Goldring, durch den man beim Scrollen hindurchfährt.
// Nach aussen gibt es nur window.LumiereGL mit init/setProgress/start/stop —
// die Seite selbst weiss nichts von Three.js.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, Clock,
  TorusGeometry, MeshPhysicalMaterial, MeshStandardMaterial,
  Color, CanvasTexture, EquirectangularReflectionMapping,
  PMREMGenerator, PointLight, AmbientLight,
  ACESFilmicToneMapping, SRGBColorSpace, MathUtils,
} from 'three';

const GOLD        = 0xd9a548;
const GOLD_BRIGHT = 0xf6c35c;
const CHAMPAGNE   = 0xf3e2b8;

// Die Umgebung, in der sich das Glas spiegelt. Statt eine HDR-Datei zu laden
// wird sie hier gezeichnet: dunkler Grund, ein warmer Lichtbogen oben, ein
// kühlerer Schimmer unten - das gibt der Brechung überhaupt erst etwas zu
// brechen, kostet aber keinen einzigen Netzwerk-Zugriff.
function makeEnvTexture(){
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.00, '#241a09');
  grad.addColorStop(0.32, '#8c6b2e');
  grad.addColorStop(0.46, '#f6c35c');
  grad.addColorStop(0.58, '#3a2c14');
  grad.addColorStop(1.00, '#070810');
  g.fillStyle = grad; g.fillRect(0, 0, 512, 256);
  // ein paar weiche Lichtquellen, damit die Kanten Glanzpunkte bekommen
  for(const [x, y, r, a] of [[120, 70, 90, .55], [370, 52, 70, .42], [250, 200, 120, .18]]){
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `rgba(255,236,190,${a})`);
    rg.addColorStop(1, 'rgba(255,236,190,0)');
    g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const tex = new CanvasTexture(c);
  tex.mapping = EquirectangularReflectionMapping;
  return tex;
}

// Die Reise des Emblems, als Tabelle statt als Trigonometrie: pro Stuetzstelle
// der Scroll-Fortschritt und wo der Ring dann steht. Dazwischen wird weich
// interpoliert. So laesst sich jede Szene einzeln nachjustieren, ohne dass
// eine Sinuskurve alle anderen mitverbiegt.
//        p     scale     x      y      z     rotX   rotY   rotZ
const KEYS = [
  [0.00, 0.38,  0.00,  1.15,  0.00,  0.20,  0.00,  0.00],  // Seuil  - klein, ueber der Wortmarke
  [0.24, 0.72,  1.25, -0.10, -0.20,  0.42,  0.85,  0.14],  // Le mot - wandert nach rechts
  [0.48, 1.55, -0.70,  0.06,  1.00,  0.72,  1.75, -0.26],  // Methode- gross, gekippt, vorn
  [0.74, 0.88, -1.45,  0.20, -2.40,  0.50,  2.60,  0.18],  // Atelier- links, Inhalt steht rechts
  [1.00, 0.44,  0.00,  0.00, -0.15,  0.26,  3.30,  0.00],  // Entrer - wieder klein, mittig
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

let renderer, scene, camera, group, ringMain, ringThin, clock;
let raf = 0, running = false, lite = false, ready = false;
let progress = 0, shown = 0;      // shown folgt progress weich nach
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
  renderer.toneMappingExposure = 1.05;
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

  group = new Group();
  scene.add(group);

  // Der Hauptring: auf dem Desktop echtes Glas mit Brechung, auf schwachen
  // Geräten poliertes Metall - optisch verwandt, aber ohne Extra-Renderpass.
  const mainMat = lite
    ? new MeshStandardMaterial({ color: GOLD, metalness: 1, roughness: 0.18, envMapIntensity: 1.5 })
    : new MeshPhysicalMaterial({
        color: 0xffffff, metalness: 0, roughness: 0.06,
        transmission: 1, thickness: 0.20, ior: 1.47,
        attenuationColor: new Color(0xa8651d), attenuationDistance: 0.60,
        specularColor: new Color(CHAMPAGNE), specularIntensity: 1,
        iridescence: 0.7, iridescenceIOR: 1.32, iridescenceThicknessRange: [120, 460],
        clearcoat: 1, clearcoatRoughness: 0.04,
        envMapIntensity: 1.9,
      });
  ringMain = new Mesh(new TorusGeometry(1.9, 0.135, lite ? 14 : 36, lite ? 72 : 220), mainMat);
  group.add(ringMain);

  // Ein dünner, heller Reif darüber - er zeichnet die Silhouette nach, damit
  // der Ring auch vor sehr dunklem Grund eine Kante behält.
  ringThin = new Mesh(
    new TorusGeometry(2.30, 0.009, 6, lite ? 96 : 240),
    new MeshStandardMaterial({ color: CHAMPAGNE, emissive: new Color(GOLD_BRIGHT), emissiveIntensity: 1.5, metalness: 1, roughness: 0.25 })
  );
  ringThin.rotation.x = Math.PI * 0.5;
  group.add(ringThin);

  scene.add(new AmbientLight(0xffe6b8, 0.5));
  const key = new PointLight(GOLD_BRIGHT, 55, 30); key.position.set(4, 5, 6); scene.add(key);
  const rim = new PointLight(CHAMPAGNE, 28, 30);   rim.position.set(-6, -3, 3); scene.add(rim);

  clock = new Clock();
  resize();
  ready = true;
  return true;
}

// Der Scroll-Fortschritt (0 = ganz oben, 1 = am Ende der Startseite) steuert
// alles: Grösse, Tiefe, Neigung. Gesetzt wird er von aussen bei jedem Scroll,
// nachgezogen wird er hier weich - sonst ruckelt die Kamera mit dem Rad mit.
function setProgress(p){ progress = Math.max(0, Math.min(1, p)); }
function setPointer(nx, ny){ pointerX = nx; pointerY = ny; }

const _k = new Array(7);
function applyTransform(p, t){
  const k = sampleKeys(p, _k);
  // Die Kamera misst senkrecht. Auf einem hochkantigen Schirm wuerde der Ring
  // deshalb das ganze Bild fuellen - dort faellt er entsprechend kleiner aus.
  const fit = Math.max(0.66, Math.min(1, camera.aspect / 1.3));
  group.scale.setScalar(k[0] * fit);
  group.position.set(k[1], k[2], k[3]);
  // Der Zeiger kippt den Ring nur leicht mit - genug, dass er auf die Maus
  // reagiert, zu wenig, um die inszenierte Bahn zu ueberschreiben.
  group.rotation.set(k[4] + py * 0.16 + Math.sin(t * 0.25) * 0.04,
                     k[5] + px * 0.22,
                     k[6]);
  ringThin.rotation.z = t * 0.22;
  camera.position.z = 7 - p * 1.2;
}

function frame(){
  if(!running){ raf = 0; return; }
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  shown += (progress - shown) * Math.min(1, dt * 3.2);
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
// Ein einzelnes Standbild - fuer prefers-reduced-motion, wo nichts laufen darf.
function renderOnce(){
  if(!ready) return;
  shown = progress; px = pointerX; py = pointerY;
  applyTransform(shown, 0);
  renderer.render(scene, camera);
}

window.LumiereGL = { init, start, stop, resize, setProgress, setPointer, renderOnce,
  get ready(){ return ready; } };
