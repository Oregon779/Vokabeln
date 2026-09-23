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
  Color, Vector2, Vector3, CanvasTexture, EquirectangularReflectionMapping,
  PMREMGenerator, PointLight, AmbientLight, MeshBasicMaterial, DoubleSide,
  ConeGeometry, ShaderMaterial, Sprite, SpriteMaterial, WebGLRenderTarget,
  ACESFilmicToneMapping, SRGBColorSpace, AdditiveBlending,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

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
    [110,  56,  64, 'rgba(255,248,214,1)'],
    [352,  40,  52, 'rgba(255,214,116,.95)'],
    [246, 178, 130, 'rgba(40,70,130,.42)'],
    [452, 142,  62, 'rgba(255,170,56,.62)'],
    [ 34, 104,  38, 'rgba(255,255,240,.9)'],   // kleine, harte Glanzpunkte
    [190,  92,  30, 'rgba(255,236,190,.85)'],
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
// Der Umriss des L, ausgelesen aus Fraunces SemiBold Italic (SIL OFL) - der
// Schnitt, in dem auch der Schriftzug "Lumière" auf der Seite steht. Von Hand
// nachgezeichnet sah das L wie ein fremder Buchstabe neben der Wortmarke aus.
// Die Tabelle ist flach: 0 = hingehen (x,y), 1 = Linie (x,y),
// 2 = quadratische Kurve (Kontrollpunkt, Ziel). Auf Hoehe 1.12 normiert und
// um den eigenen Mittelpunkt gelegt.
const L_OUTLINE = [
  0, 0.095, -0.5388, 1, -0.3814, -0.5388, 2, -0.4081, -0.5388, -0.4183,
  -0.5286, 2, -0.4285, -0.5184, -0.4278, -0.5035, 2, -0.427, -0.4886,
  -0.4164, -0.478, 2, -0.4058, -0.4674, -0.3877, -0.4619, 1, -0.3453,
  -0.4525, 2, -0.3234, -0.4462, -0.3116, -0.4317, 2, -0.2998, -0.4172,
  -0.2904, -0.3873, 2, -0.2826, -0.3583, -0.2684, -0.3065, 2, -0.2543,
  -0.2547, -0.2362, -0.188, 2, -0.2182, -0.1213, -0.1986, -0.0475, 2,
  -0.1789, 0.0263, -0.1597, 0.0997, 2, -0.1405, 0.1731, -0.1236, 0.2386, 2,
  -0.1067, 0.3041, -0.0946, 0.3536, 2, -0.0824, 0.403, -0.0777, 0.4297, 2,
  -0.0738, 0.4478, -0.0797, 0.4588, 2, -0.0856, 0.4697, -0.0997, 0.4737, 1,
  -0.146, 0.4854, 2, -0.1609, 0.4909, -0.1695, 0.4988, 2, -0.1782, 0.5066,
  -0.1782, 0.52, 2, -0.1782, 0.538, -0.164, 0.549, 2, -0.1499, 0.56,
  -0.1248, 0.56, 1, 0.2417, 0.56, 2, 0.2676, 0.56, 0.2774, 0.5502, 2,
  0.2873, 0.5404, 0.2873, 0.5255, 2, 0.2873, 0.5098, 0.2763, 0.4992, 2,
  0.2653, 0.4886, 0.2496, 0.4831, 1, 0.1994, 0.4721, 2, 0.1813, 0.4682,
  0.1711, 0.4564, 2, 0.1609, 0.4446, 0.1523, 0.4179, 2, 0.1413, 0.3811,
  0.1256, 0.3253, 2, 0.1099, 0.2696, 0.0914, 0.2025, 2, 0.073, 0.1354,
  0.0542, 0.0632, 2, 0.0353, -0.009, 0.0169, -0.0793, 2, -0.0016, -0.1495,
  -0.0169, -0.2107, 2, -0.0322, -0.272, -0.0432, -0.3183, 2, -0.0542,
  -0.3646, -0.0589, -0.3881, 2, -0.0683, -0.4329, -0.0522, -0.4513, 2,
  -0.0361, -0.4697, 0, -0.4697, 1, 0.1005, -0.4697, 2, 0.1507, -0.4697,
  0.1895, -0.4485, 2, 0.2284, -0.4274, 0.2633, -0.3783, 2, 0.2982, -0.3293,
  0.3375, -0.2468, 2, 0.35, -0.2209, 0.363, -0.2103, 2, 0.3759, -0.1997,
  0.3916, -0.1997, 2, 0.4121, -0.1997, 0.4203, -0.2127, 2, 0.4285, -0.2256,
  0.4285, -0.2468, 2, 0.4262, -0.3151, 0.4089, -0.3728, 2, 0.3916, -0.4305,
  0.363, -0.4721, 2, 0.3344, -0.5137, 0.2975, -0.5368, 2, 0.2606, -0.56,
  0.2174, -0.56, 2, 0.1978, -0.56, 0.1813, -0.5545, 2, 0.1648, -0.549,
  0.1448, -0.5439, 2, 0.1248, -0.5388, 0.095, -0.5388
];

function makeLetterL(mat){
  const s = new Shape();
  for(let i = 0; i < L_OUTLINE.length; ){
    const op = L_OUTLINE[i++];
    if(op === 0)      s.moveTo(L_OUTLINE[i++], L_OUTLINE[i++]);
    else if(op === 1) s.lineTo(L_OUTLINE[i++], L_OUTLINE[i++]);
    else              s.quadraticCurveTo(L_OUTLINE[i++], L_OUTLINE[i++],
                                         L_OUTLINE[i++], L_OUTLINE[i++]);
  }
  s.closePath();
  // Tief genug, dass beim Drehen die Flanke sichtbar wird, mit einer Fase,
  // die das Licht an der Kante zu einem Grat zieht.
  const geo = new ExtrudeGeometry(s, {
    depth: 0.34, bevelEnabled: true, bevelThickness: 0.05,
    bevelSize: 0.038, bevelSegments: lite ? 1 : 5, curveSegments: lite ? 4 : 14,
  });
  geo.center();
  return new Mesh(geo, mat);
}

// Die Spirale unter dem Zeichen, wie in der Referenz: zwei Straenge
// verlassen den Reif genau an seiner linken und rechten Seite und winden sich
// mit GLEICHBLEIBENDEM Radius eine halbe Drehung um die Hochachse. Von vorn
// kreuzen sie sich dadurch zu einem X und laufen wieder auseinander; von der
// Seite (Muenze hochkant) bilden sie eine Linse, die unten zusammenlaeuft.
// Beides zeigt dieselbe Form - erst die Drehung macht sie als Raum lesbar.
const HELIX_R = 1.9;          // = Radius des grossen Reifs, dort setzen sie an
const HELIX_LEN = 10.6;       // Kreuzung bei halber Laenge, ~2,8 Radien unter der Mitte
const HELIX_TWIST = Math.PI;  // halbe Drehung: kreuzt genau einmal
function makeHelix(mat, lite){
  const g = new Group();
  g.userData.curves = [];
  const steps = lite ? 48 : 120;
  const tubular = lite ? 72 : 200, radial = lite ? 5 : 8, thick = 0.046;
  for(const phase of [0, Math.PI]){
    const pts = [];
    for(let i = 0; i <= steps; i++){
      const u = i / steps;
      // Die Drehung setzt weich ein und laeuft weich aus - so verlassen die
      // Straenge den Reif senkrecht, wie an ihm entlanggezogen.
      const a = phase + HELIX_TWIST * (u * u * (3 - 2 * u));
      pts.push(new Vector3(Math.cos(a) * HELIX_R, -u * HELIX_LEN, Math.sin(a) * HELIX_R));
    }
    const curve = new CatmullRomCurve3(pts);
    g.userData.curves.push(curve);
    const geo = new TubeGeometry(curve, tubular, thick, radial, false);
    // Am Ende nicht abgeschnitten aufhoeren, sondern duenn auslaufen: jeder
    // Querschnittsring wird zur Kurvenmitte hin zusammengezogen.
    const pos = geo.attributes.position, c = new Vector3(), v = new Vector3();
    for(let r = 0; r <= tubular; r++){
      const u = r / tubular;
      const k = u < 0.72 ? 1 : 1 - 0.9 * Math.pow((u - 0.72) / 0.28, 1.4);
      if(k === 1) continue;
      curve.getPointAt(u, c);
      for(let j = 0; j <= radial; j++){
        const idx = r * (radial + 1) + j;
        v.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(k).add(c);
        pos.setXYZ(idx, v.x, v.y, v.z);
      }
    }
    geo.computeVertexNormals();
    // Wie weit jede Ecke den Strang hinunter liegt (0 am Reif, 1 am Ende) -
    // daran laeuft das Glanzlicht entlang. Der zweite Strang ist um einen
    // halben Umlauf versetzt, damit nie beide zugleich aufleuchten.
    const along = new Float32Array((tubular + 1) * (radial + 1));
    for(let r = 0; r <= tubular; r++)
      for(let j = 0; j <= radial; j++) along[r * (radial + 1) + j] = r / tubular;
    geo.setAttribute('aAlong', new Float32BufferAttribute(along, 1));
    geo.setAttribute('aPhase', new Float32BufferAttribute(
      new Float32Array(along.length).fill(phase ? 0.5 : 0), 1));
    g.add(new Mesh(geo, mat));
  }
  return g;
}

// Die Straenge sind poliertes Gold wie der Ring und tragen ein Glanzlicht,
// das langsam an ihnen hinunterlaeuft - wie Licht in einer Glasfaser. Dazu
// eine harte Lichtkante am Rand (Fresnel), damit sie vor dem dunklen Grund
// als Koerper stehen und nicht als gezeichnete Linie.
const glint = { value: 0 };
function strandGlint(mat){
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uGlint = glint;
    sh.vertexShader = 'attribute float aAlong;\nattribute float aPhase;\n'
      + 'varying float vAlong;\nvarying float vPhase;\n'
      + sh.vertexShader.replace('#include <begin_vertex>',
          '#include <begin_vertex>\n  vAlong = aAlong; vPhase = aPhase;');
    sh.fragmentShader = 'uniform float uGlint;\nvarying float vAlong;\nvarying float vPhase;\n'
      + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  {
    // Kopf des Glanzlichts: faehrt von knapp ueber dem Reif bis hinter das
    // Ende. Vorn scharf, nach oben ein laengerer Nachschein.
    float head = fract(uGlint + vPhase) * 1.3 - 0.1;
    float dd = vAlong - head;
    float g = exp(-dd * dd / (dd > 0.0 ? 0.00018 : 0.0026));
    // Am Reif einblenden, am duennen Ende aus - am Ansatz wuerde es sonst
    // mit dem Reif zu einem Fleck verschmelzen.
    g *= smoothstep(0.02, 0.16, vAlong) * (1.0 - smoothstep(0.8, 1.0, vAlong));
    totalEmissiveRadiance += vec3(1.0, 0.86, 0.58) * g * 2.6;
    // Harte Lichtkante: nur der aeusserste Rand, sonst wird der Strang dick.
    float rim = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));
    totalEmissiveRadiance += vec3(1.0, 0.72, 0.3) * pow(rim, 4.0) * 0.55;
  }`);
  };
  return mat;
}

// Ein Reif aus einzelnen Strichen statt einer geschlossenen Linie. Er laeuft
// dem grossen Reif entgegen - zwei Drehungen in verschiedene Richtungen
// lesen sich als Mechanik, eine allein nur als Wackeln.
function makeSegmentRing(mat, radius, count, lite){
  const g = new Group();
  const seg = (Math.PI * 2 / count) * 0.42;      // Strich, dann Luecke
  for(let i = 0; i < count; i++){
    const a0 = (i / count) * Math.PI * 2;
    const pts = [];
    const steps = lite ? 3 : 6;
    for(let k = 0; k <= steps; k++){
      const a = a0 + seg * (k / steps);
      pts.push(new Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0));
    }
    const curve = new CatmullRomCurve3(pts);
    g.add(new Mesh(new TubeGeometry(curve, lite ? 3 : 8, 0.026, lite ? 4 : 8, false), mat));
  }
  return g;
}

/* ------------------------------------------------------ Bildabschluss ---- */

// Vignette, Farbsaum und Korn in einem einzigen Durchgang. Drei getrennte
// Paesse waeren drei Mal die ganze Flaeche lesen und schreiben - das hier
// kostet einen Durchgang und laesst sich gemeinsam abstimmen.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime:    { value: 0 },
    uAmount:  { value: 1 },     // faehrt mit der Startseite hoch und runter
  },
  vertexShader: `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAmount;
    varying vec2 vUv;

    // Billiges, stabiles Rauschen - fuer Korn reicht es voellig.
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

    void main(){
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);

      // Farbsaum: die Kanaele werden zum Rand hin auseinandergezogen. In der
      // Bildmitte bleibt alles deckungsgleich, sonst wuerde Schrift flimmern.
      float disp = 0.0007 * uAmount * r2 * 4.0;
      vec2 dir = normalize(c + 1e-6);
      vec4 col;
      col.r = texture2D(tDiffuse, vUv + dir * disp).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - dir * disp).b;
      col.a = 1.0;

      // Vignette: zum Rand hin abdunkeln, damit der Blick in der Mitte bleibt.
      float vig = smoothstep(0.95, 0.28, r2 * 1.9);
      col.rgb *= mix(1.0, mix(0.52, 1.0, vig), uAmount);

      // Korn: in den dunklen Flaechen am staerksten, in den hellen kaum -
      // sonst rauscht das Gold, statt dass der Grund lebendig wird.
      float g = hash(vUv * vec2(1920.0, 1080.0) + fract(uTime) * 91.7) - 0.5;
      float luma = dot(col.rgb, vec3(0.299, 0.587, 0.114));
      col.rgb += g * 0.038 * uAmount * (1.0 - smoothstep(0.0, 0.7, luma));

      gl_FragColor = col;
    }
  `,
};

/* ---------------------------------------------------------- Lichtschlieren */

// Was die Referenz teuer aussehen laesst, ist nicht das Zeichen - es sind die
// Lichtbaender, die in grossen Boegen daran vorbeiziehen. Jede Schliere ist
// ein Punkt, der eine Bahn um die Achse zieht und eine Spur hinter sich
// herschleppt; die Spur wird als schmales Band gezeichnet, das nach hinten
// duenner und dunkler wird. Additiv ueberlagert heisst: Schwarz ist
// unsichtbar, der Verlauf ins Dunkle ist also zugleich das Ausblenden - das
// spart den Alphakanal pro Ecke.
const STREAK_LEN = () => (lite ? 14 : 26);   // Stuetzpunkte je Spur
// Halb so viele wie frueher - sie sollen das Zeichen rahmen, nicht mit ihm
// um Aufmerksamkeit kaempfen.
const STREAK_NUM = () => (lite ? 5 : 13);
const TRAIL_STEP = 0.1;      // Sekunden zwischen zwei Stuetzpunkten der Spur

function makeStreaks(){
  const n = STREAK_NUM(), len = STREAK_LEN();
  // Jedes Glied wird aus zwei Baendern gebaut: von der Kante (schwarz) zur
  // Mitte (hell) und wieder zur Kante. Ein einzelnes Band haette eine harte
  // Kante und saehe nach gezeichnetem Strich aus, nicht nach Licht.
  const verts = (len - 1) * 4 * 3;           // vier Dreiecke je Glied
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(new Float32Array(n * verts * 3), 3));
  geo.setAttribute('color',    new Float32BufferAttribute(new Float32Array(n * verts * 3), 3));
  // ACHTUNG: Float32BufferAttribute legt eine Kopie des uebergebenen Feldes
  // an. Wer jeden Frame neu hineinschreibt, muss mit dem Feld des Attributs
  // arbeiten - schreibt man in das hineingereichte, bleibt das Mesh leer.
  const pos = geo.attributes.position.array;
  const col = geo.attributes.color.array;
  const mat = new MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0,
    blending: AdditiveBlending, depthWrite: false, side: DoubleSide,
  });
  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false;                // die Spuren reichen weit hinaus

  const band = [];
  for(let i = 0; i < n; i++){
    const warm = Math.random();
    band.push({
      a:  Math.random() * Math.PI * 2,       // Winkel auf der Umlaufbahn
      w:  (0.24 + Math.random() * 0.5) * (Math.random() < 0.3 ? -1 : 1),
      r0: 2.2 + Math.random() * 3.3,         // Grundabstand von der Achse
      ar: 0.4 + Math.random() * 1.2,         // wie stark der Abstand atmet
      fr: 0.18 + Math.random() * 0.5,
      // Ueber und unter dem Text, nicht hindurch: in der Mitte bleibt ein
      // Streifen frei, sonst kaempfen Schlieren und Schrift gegeneinander.
      y0: (Math.random() < 0.5 ? -1 : 1) * (1.9 + Math.random() * 2.6),
      ay: 0.2 + Math.random() * 0.6,
      fy: 0.2 + Math.random() * 0.55,
      ph: Math.random() * 6.28,
      wd: (lite ? 0.009 : 0.005) + Math.random() * 0.011,
      // Warmes Gold bis helles Champagner - dieselbe Familie wie der Rest.
      c:  new Color(1, 0.66 + warm * 0.2, 0.2 + warm * 0.34),
      trail: null,
    });
  }
  mesh.userData = { band, len, pos, col };
  return mesh;
}

// 0 vor der Ebene des Zeichens, 1 deutlich dahinter (Weltmasse). Auch
// dahinter verlischt eine Schliere, solange sie im Umriss des Zeichens steht
// - sonst schneidet sie durch den Ring hindurch sichtbar ueber das L.
let streakFront = 0, streakClear = 1;
function behind(lx, ly, wz){
  const x = Math.max(0, Math.min(1, (streakFront - 0.4 - wz) / 1.8));
  const q = Math.max(0, Math.min(1, (Math.hypot(lx, ly) / streakClear - 0.9) / 0.5));
  return x * x * (3 - 2 * x) * q * q * (3 - 2 * q);
}

const _dir = new Vector3(), _side = new Vector3(), _toCam = new Vector3(), _p = new Vector3();

function updateStreaks(mesh, t, dt, amount){
  const mat = mesh.material;
  mat.opacity = amount;
  mesh.visible = amount > 0.004;
  if(!mesh.visible) return;

  const { band, len, pos, col } = mesh.userData;
  const gz = mesh.position.z;
  let o = 0;
  for(const b of band){
    b.a += b.w * dt;
    // Die Bahn eines Gliedes - dieselbe Formel fuer den Kopf und fuer jeden
    // Punkt der Spur, nur zeitversetzt. Dadurch braucht es keinen Verlauf im
    // Speicher: die Spur ist die Vergangenheit der Bahn.
    if(!b.trail) b.trail = new Float32Array(len * 3);
    for(let i = 0; i < len; i++){
      const tt = t - i * TRAIL_STEP;
      const ang = b.a - b.w * (i * TRAIL_STEP);
      const r = b.r0 + Math.sin(tt * b.fr + b.ph) * b.ar;
      b.trail[i * 3]     = Math.cos(ang) * r;
      b.trail[i * 3 + 1] = b.y0 + Math.sin(tt * b.fy + b.ph * 1.7) * b.ay;
      b.trail[i * 3 + 2] = Math.sin(ang) * r;
    }
    for(let i = 0; i < len - 1; i++){
      const j = i * 3, k = j + 3;
      _p.set(b.trail[j], b.trail[j + 1], b.trail[j + 2]);
      _dir.set(b.trail[k] - b.trail[j], b.trail[k + 1] - b.trail[j + 1],
               b.trail[k + 2] - b.trail[j + 2]);
      if(_dir.lengthSq() < 1e-10) _dir.set(0, 1, 0);
      _toCam.copy(camera.position).sub(_p);
      // Das Band steht immer quer zur Blickrichtung - sonst verschwindet es,
      // sobald man genau auf seine Kante schaut.
      _side.crossVectors(_dir, _toCam).normalize();

      const u0 = i / (len - 1), u1 = (i + 1) / (len - 1);
      // Breite: null am Kopf, Maximum kurz dahinter, null am Ende. Damit hat
      // die Schliere die Form eines Blattes statt abgehackter Enden.
      const w0 = b.wd * Math.sin(Math.PI * Math.pow(u0, 0.42));
      const w1 = b.wd * Math.sin(Math.PI * Math.pow(u1, 0.42));
      // Helligkeit: vorn gleissend (ueber der Bloom-Schwelle), nach hinten
      // ins Schwarze - additiv ueberlagert ist Schwarz das Ausblenden.
      const ax = b.trail[j], ay = b.trail[j + 1], az = b.trail[j + 2];
      const bx = b.trail[k], by = b.trail[k + 1], bz = b.trail[k + 2];
      // Nie vor dem Zeichen: sobald eine Schliere auf ihrer Bahn nach vorn
      // kommt, verlischt sie. Sichtbar bleibt nur der Bogen dahinter - so
      // rahmt das Licht das Zeichen, statt ihm ins Bild zu laufen.
      const g0 = 0.6 * Math.pow(1 - u0, 1.8) * behind(ax, ay, az + gz),
            g1 = 0.6 * Math.pow(1 - u1, 1.8) * behind(bx, by, bz + gz);
      const c = b.c;
      const sx = _side.x, sy = _side.y, sz = _side.z;
      // Kante oben / Mitte / Kante unten, je an beiden Enden des Gliedes
      const A = [ax + sx * w0, ay + sy * w0, az + sz * w0,
                 ax, ay, az,
                 ax - sx * w0, ay - sy * w0, az - sz * w0];
      const B = [bx + sx * w1, by + sy * w1, bz + sz * w1,
                 bx, by, bz,
                 bx - sx * w1, by - sy * w1, bz - sz * w1];
      // Zwei Vierecke: Kante->Mitte und Mitte->Kante.
      const idx = [0,1,3, 1,4,3, 1,2,4, 2,5,4];
      const P = [A[0],A[1],A[2], A[3],A[4],A[5], A[6],A[7],A[8],
                 B[0],B[1],B[2], B[3],B[4],B[5], B[6],B[7],B[8]];
      // Nur die Mittellinie leuchtet; die Kanten laufen nach Schwarz aus.
      const G = [0, g0, 0, 0, g1, 0];
      for(let q = 0; q < 12; q++){
        const v = idx[q] * 3, g = G[idx[q]];
        pos[o]     = P[v];     pos[o + 1] = P[v + 1]; pos[o + 2] = P[v + 2];
        col[o]     = c.r * g;  col[o + 1] = c.g * g;  col[o + 2] = c.b * g;
        o += 3;
      }
    }
  }
  mesh.geometry.attributes.position.needsUpdate = true;
  mesh.geometry.attributes.color.needsUpdate = true;
}

/* ----------------------------------------------------------------- Turm  */

// Der Eiffelturm kommt als Modell (tower.glb, Johnson Martin, CC-BY-4.0) und
// wird erst geholt, wenn man sich seiner Szene naehert - der erste
// Seitenaufruf soll davon nichts merken.
const TOWER_HEIGHT = 10;        // Zielhoehe in Weltmassen, das Modell wird skaliert
// Der Turm steht in derselben Welt wie das Zeichen, weit dahinter. Nichts
// wird ueberblendet: die Kamera fliegt beim Scrollen einfach hin - durch das
// Punktfeld, am Zeichen vorbei. Von der Buehne des Zeichens aus sieht man ihn
// beim Naeherkommen klein am Horizont.
const TOWER_AT = new Vector3(0, 0, -38);
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

// Der Suchscheinwerfer auf der Spitze - der echte Turm hat einen, der nachts
// kreist. Zwei gegenlaeufige Lichtkegel, als offener Kegelmantel mit einem
// Shader, der zur Kegelachse hin hell und zum Rand und zum Ende hin durchsichtig
// wird. Additiv, ohne Tiefenschreiben: so wirkt er wie Licht im Dunst statt
// wie ein fester Koerper.
const BEAM_LEN = 38, BEAM_R = 1.7;
function makeBeacon(lite){
  const geo = new ConeGeometry(BEAM_R, BEAM_LEN, lite ? 16 : 32, 1, true);
  geo.translate(0, -BEAM_LEN / 2, 0);        // Spitze in den Ursprung, Kegel nach -Y
  const mat = new ShaderMaterial({
    uniforms: { uOpacity: { value: 0 }, uColor: { value: new Color(0xffd98a) } },
    vertexShader: `
      varying float vLen;
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vAxis;
      void main(){
        vLen = -position.y / ${BEAM_LEN.toFixed(1)};
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = -mv.xyz;
        vNormal = normalize(normalMatrix * normal);
        vAxis = normalize(mat3(modelViewMatrix) * vec3(0.0, -1.0, 0.0));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uOpacity;
      uniform vec3 uColor;
      varying float vLen;
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vAxis;
      void main(){
        // Am hellsten ist ein Lichtkegel in der Mitte: dort geht der Blick am
        // laengsten durch ihn hindurch und trifft den Mantel vorn und hinten
        // frontal. Zum Rand hin streift der Blick nur noch - dort laeuft er
        // weich aus. (Umgekehrt gerechnet leuchteten die Raender, und der
        // Kegel sah aus wie zwei Klingen.)
        float facing = abs(dot(normalize(vNormal), normalize(vView)));
        float core = pow(facing, 1.6);
        float fall = pow(1.0 - vLen, 1.6) * smoothstep(0.0, 0.05, vLen);
        // Schaut man in die Oeffnung des Kegels hinein, liegt der ganze Mantel
        // flach im Blick und wuerde zu einer milchigen Scheibe - dort blendet
        // der Strahl sich aus. Ein echter Scheinwerfer blendet in dem Moment
        // ohnehin nur kurz auf.
        float along = abs(dot(normalize(vAxis), normalize(vView)));
        float endOn = 1.0 - smoothstep(0.45, 0.9, along);
        gl_FragColor = vec4(uColor * core * fall * endOn * uOpacity, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
  });
  const g = new Group();
  for(const a of [0, Math.PI]){
    const beam = new Mesh(geo, mat);
    // -Y nach aussen drehen, fast waagrecht wie beim echten Turm: die Kegel
    // ziehen knapp ueber die Kamera hinweg und sind weiter draussen am Himmel
    // im Bild. Steiler angehoben liefen sie nur ueber den oberen Bildrand.
    beam.rotation.set(0, a, Math.PI / 2 + 0.05);
    g.add(beam);
  }
  g.userData.mat = mat;
  return g;
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
    const beacon = makeBeacon(lite);
    beacon.position.y = TOWER_HEIGHT * 0.985;
    g.add(beacon);
    g.visible = false;
    scene.add(g);
    tower = g;
    towerMats = [mat, sparks.material];
    addParisTower(model);
    tower.userData.sparks = sparks;
    tower.userData.beacon = beacon;
    towerLoading = false;
  }, undefined, err => {
    console.warn('Turm-Modell konnte nicht geladen werden:', err);
    towerLoading = false;
  });
}

/* ------------------------------------------------------------- Staub  */

// Staub an den Straengen, wie in der Referenz: nicht ueber den ganzen
// Hintergrund verteilt, sondern als Wolke um die Kreuzung und nach unten
// hin, oben am Ring nur vereinzelt. Er haengt am Zeichen (dreht und schwebt
// mit) und wird vom Glanzlicht beleuchtet: wo es gerade im Strang
// vorbeilaeuft, leuchtet der Staub daneben warm auf.
function gauss(){
  let u = 0, v = 0;
  while(u === 0) u = Math.random();
  while(v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function makeDust(curves){
  const n = lite ? 700 : 2400;
  const pos = new Float32Array(n * 3);
  const aU = new Float32Array(n), aPhase = new Float32Array(n);
  const aSeed = new Float32Array(n), aSize = new Float32Array(n);
  const P = new Vector3(), D = new Vector3();
  for(let i = 0; i < n; i++){
    const s = i & 1;
    const r = Math.random();
    let u;
    if(r < 0.55)      u = 0.5 + gauss() * 0.16;          // dicht um die Kreuzung
    else if(r < 0.88) u = 0.3 + Math.random() * 0.7;     // nach unten hin
    else              u = 0.04 + Math.random() * 0.3;    // vereinzelt am Ring
    u = Math.max(0.03, Math.min(1, u));
    curves[s].getPointAt(u, P);
    // Weiter unten streut der Staub breiter - er sinkt und verweht.
    const rad = (0.1 + 0.8 * u * u) * Math.abs(gauss());
    D.set(gauss(), gauss() * 0.6, gauss()).normalize().multiplyScalar(rad);
    pos[i * 3]     = P.x + D.x;
    pos[i * 3 + 1] = P.y + D.y;
    pos[i * 3 + 2] = P.z + D.z;
    aU[i] = u;
    aPhase[i] = s ? 0.5 : 0;
    aSeed[i] = Math.random();
    // Meist feiner Staub, selten ein groesseres, weiches Korn.
    aSize[i] = Math.random() < 0.06 ? 3.5 + Math.random() * 3 : 1.1 + Math.random() * 1.5;
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('aU',       new Float32BufferAttribute(aU, 1));
  geo.setAttribute('aPhase',   new Float32BufferAttribute(aPhase, 1));
  geo.setAttribute('aSeed',    new Float32BufferAttribute(aSeed, 1));
  geo.setAttribute('aSize',    new Float32BufferAttribute(aSize, 1));
  const mat = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uGlint: glint, uOpacity: { value: 1 }, uPx: { value: 1 },
    },
    vertexShader: `
      attribute float aU, aPhase, aSeed, aSize;
      uniform float uTime, uGlint, uPx;
      varying vec3 vCol;
      varying float vA, vBig;
      void main(){
        vec3 p = position;
        float s = aSeed * 6.2831;
        // Schweben um den eigenen Platz, unten weiter ausholend.
        p += vec3(sin(uTime * 0.31 + s), sin(uTime * 0.23 + s * 1.7),
                  cos(uTime * 0.27 + s * 2.3)) * (0.06 + aU * 0.14);
        // Langsames Absinken mit Ein- und Ausblenden - wie Staub im Licht.
        float cyc = fract(uTime * 0.03 * (0.5 + aSeed) + aSeed);
        p.y -= cyc * 0.9;
        float life = smoothstep(0.0, 0.15, cyc) * (1.0 - smoothstep(0.7, 1.0, cyc));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        // Dasselbe Glanzlicht wie im Strang (strandGlint): Kopf und Takt.
        float head = fract(uGlint + aPhase) * 1.3 - 0.1;
        float dd = aU - head;
        float lit = exp(-dd * dd / 0.005) * smoothstep(0.02, 0.16, aU);
        float d = max(0.5, -mv.z);
        gl_PointSize = aSize * uPx * (1.0 + lit * 0.7) * 8.0 / d;
        vBig = step(3.0, aSize);
        vCol = mix(vec3(0.86, 0.56, 0.2) * 0.6, vec3(1.0, 0.86, 0.58), lit);
        float tw = 0.7 + 0.3 * sin(uTime * (0.8 + aSeed) + s * 3.0);
        vA = (0.32 + 1.5 * lit) * life * tw * (vBig > 0.5 ? 0.35 : 1.0);
      }`,
    fragmentShader: `
      uniform float uOpacity;
      varying vec3 vCol;
      varying float vA, vBig;
      void main(){
        vec2 c = gl_PointCoord * 2.0 - 1.0;
        float r = length(c);
        if(r > 1.0) discard;
        // Feiner Staub als weicher Punkt, grosse Koerner als Scheibe mit
        // etwas hellerem Rand - unscharf, wie vor der Linse.
        float a = mix(exp(-r * r * 4.0),
                      smoothstep(1.0, 0.8, r) * (0.45 + 0.55 * smoothstep(0.5, 0.9, r)), vBig);
        gl_FragColor = vec4(vCol, a * vA * uOpacity);
      }`,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  });
  const pts = new Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

/* ------------------------------------------------- Paris bei Nacht  */

// Das "Video" auf dem Weg zum Turm, wie der Wald aus Punkten in der
// Referenz. Es gibt keine Videodatei: eine zweite, kleine Szene - Paris bei
// Nacht mit Turm, Scheinwerfer, Strassenlichtern, Verkehr und der Seine -
// wird Bild fuer Bild in eine winzige Textur gerendert (256 x 144). Ein
// grosses Feld aus Punkten liest daraus seine Farben. Helle Stellen treten
// nach vorn und werden groesser, dunkle verschwinden: man erkennt die Stadt
// schemenhaft, aber sie bleibt Hintergrund.
const PARIS = {
  rt: () => (lite ? [128, 72] : [256, 144]),
  grid: () => (lite ? [100, 56] : [200, 112]),
  // Das Punktfeld: ein Stueck Zylindermantel hinter dem Turm, zur Flugbahn hin
  // gewoelbt. Mittelpunkt, Radius, Oeffnungswinkel, Hoehe.
  C: new Vector3(0, 3, -10), R: 50, ARC: 1.6, H: 44,
};

function makeParisLights(){
  // Stadtlichter als Punkte in der Ebene y=0. Jedes Licht hat eine Farbe,
  // einen Zufallswert fuers Flackern und - beim Verkehr - eine Fahrtrichtung.
  const base = [], dir = [], col = [], seed = [];
  const push = (x, z, c, dx = 0, dz = 0, y = 0) => {
    base.push(x, y, z); dir.push(dx, 0, dz); col.push(c[0], c[1], c[2]); seed.push(Math.random());
  };
  const amber = [1.0, 0.66, 0.3], warm = [1.0, 0.86, 0.66], cool = [0.72, 0.82, 1.0];
  const pick = () => { const r = Math.random(); return r < 0.55 ? amber : r < 0.93 ? warm : cool; };
  const inPark = (x, z) => Math.abs(x) < 4.5 && z > 4 && z < 42;     // Marsfeld: dunkel
  const river  = (x) => -9 + Math.sin(x * 0.045) * 7;                 // die Seine
  const S = lite ? 1.9 : 1.25;
  // Strassenraster, leicht verdreht wie ein echter Stadtplan.
  for(let k = -14; k <= 14; k++){
    for(let t = -90; t <= 90; t += S){
      const a = 0.35;
      for(const [gx, gz] of [[t, k * 6.5], [k * 6.5, t]]){
        const x = gx * Math.cos(a) - gz * Math.sin(a) + (Math.random() - 0.5) * 0.6;
        const z = gx * Math.sin(a) + gz * Math.cos(a) + (Math.random() - 0.5) * 0.6;
        if(x * x + z * z > 95 * 95 || inPark(x, z) || Math.abs(z - river(x)) < 3) continue;
        if(Math.random() < 0.55) push(x, z, pick());
      }
    }
  }
  // Sternfoermige Avenuen um einen Platz - Paris hat viele davon.
  for(const [cx, cz] of [[-38, -30], [30, 26], [-26, 40]]){
    for(let a = 0; a < 12; a++){
      const ang = a * Math.PI / 6 + Math.random() * 0.2;
      for(let r = 2; r < 40; r += S * 0.8){
        const x = cx + Math.cos(ang) * r, z = cz + Math.sin(ang) * r;
        if(inPark(x, z) || Math.abs(z - river(x)) < 3) continue;
        push(x, z, warm);
      }
    }
  }
  // Uferlichter und ihre Spiegelung im Wasser.
  for(let x = -95; x <= 95; x += S * 0.7){
    const z = river(x);
    push(x, z - 3.1, warm); push(x, z + 3.1, warm);
    if(Math.random() < 0.7) push(x + Math.random(), z + (Math.random() - 0.5) * 4, [0.9, 0.78, 0.55], 0, 0, -0.01);
  }
  // Verkehr: Lichter, die auf den Strassen entlangziehen.
  const cars = lite ? 180 : 520;
  for(let i = 0; i < cars; i++){
    const k = Math.round((Math.random() - 0.5) * 28) * 6.5, a = 0.35;
    const along = Math.random() < 0.5;
    const t = (Math.random() - 0.5) * 170;
    const gx = along ? t : k, gz = along ? k : t;
    const x = gx * Math.cos(a) - gz * Math.sin(a), z = gx * Math.sin(a) + gz * Math.cos(a);
    const L = 24 * (Math.random() < 0.5 ? 1 : -1);
    const dx = (along ? Math.cos(a) : -Math.sin(a)) * L, dz = (along ? Math.sin(a) : Math.cos(a)) * L;
    push(x, z, Math.random() < 0.5 ? [1, 0.95, 0.85] : [1, 0.35, 0.2], dx, dz);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(base, 3));
  geo.setAttribute('aDir',     new Float32BufferAttribute(dir, 3));
  geo.setAttribute('color',    new Float32BufferAttribute(col, 3));
  geo.setAttribute('aSeed',    new Float32BufferAttribute(seed, 1));
  const mat = new ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      attribute vec3 aDir;
      attribute vec3 color;
      attribute float aSeed;
      uniform float uTime;
      varying vec3 vCol;
      void main(){
        float moving = step(0.001, length(aDir));
        vec3 p = position + aDir * (fract(uTime * 0.045 * (0.6 + aSeed) + aSeed) - 0.5) * moving;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(40.0 / -mv.z, 1.0, 2.6);
        // Wasser flackert schnell, die Stadt kaum.
        float water = step(p.y, -0.005);
        float tw = mix(0.8 + 0.2 * sin(uTime * 1.3 + aSeed * 40.0),
                       0.35 + 0.65 * abs(sin(uTime * 3.0 + aSeed * 60.0)), water);
        vCol = color * tw;
      }`,
    fragmentShader: `
      varying vec3 vCol;
      void main(){ gl_FragColor = vec4(vCol, 1.0); }`,
    depthWrite: false,
  });
  const pts = new Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

function makeParis(){
  const [vw, vh] = PARIS.rt();
  const rt = new WebGLRenderTarget(vw, vh);
  const sc = new Scene();
  sc.background = new Color(0x03050b);
  const cam = new PerspectiveCamera(46, vw / vh, 0.5, 400);

  const lights = makeParisLights();
  sc.add(lights);

  // Der Lichtschein ueber der Stadt am Horizont.
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,170,90,0.4)');
  g.addColorStop(0.5, 'rgba(160,80,40,0.1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const glowTex = new CanvasTexture(c);
  const sky = new Sprite(new SpriteMaterial({ map: glowTex, blending: AdditiveBlending, depthWrite: false }));
  sky.scale.set(320, 44, 1);
  sc.add(sky);

  // Der Scheinwerfer gehoert auch hierher - er ist das, was sich im Bild
  // am deutlichsten bewegt.
  const beacon = makeBeacon(true);
  beacon.position.y = TOWER_HEIGHT * 0.985;
  beacon.userData.mat.uniforms.uOpacity.value = 0.55;
  sc.add(beacon);

  // Der Punktvorhang in der Hauptszene.
  const [gw, gh] = PARIS.grid();
  const n = gw * gh;
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2), seed = new Float32Array(n);
  let q = 0;
  for(let j = 0; j < gh; j++){
    for(let i = 0; i < gw; i++, q++){
      const u = (i + 0.5 + (Math.random() - 0.5) * 0.8) / gw;
      const v = (j + 0.5 + (Math.random() - 0.5) * 0.8) / gh;
      const ang = (u - 0.5) * PARIS.ARC;
      const px = PARIS.C.x + Math.sin(ang) * PARIS.R;
      const pz = PARIS.C.z - Math.cos(ang) * PARIS.R;
      const py = PARIS.C.y + (v - 0.5) * PARIS.H;
      pos[q * 3] = px; pos[q * 3 + 1] = py; pos[q * 3 + 2] = pz;
      // Nach innen, zur Flugbahn hin - dorthin treten helle Stellen vor.
      nrm[q * 3] = -Math.sin(ang); nrm[q * 3 + 1] = 0; nrm[q * 3 + 2] = Math.cos(ang);
      uv[q * 2] = u; uv[q * 2 + 1] = v;
      seed[q] = Math.random();
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('aN',       new Float32BufferAttribute(nrm, 3));
  geo.setAttribute('aUV',      new Float32BufferAttribute(uv, 2));
  geo.setAttribute('aSeed',    new Float32BufferAttribute(seed, 1));
  const mat = new ShaderMaterial({
    uniforms: {
      uTex: { value: rt.texture }, uTime: { value: 0 }, uVis: { value: 0 },
      uViewH: { value: 900 },
    },
    vertexShader: `
      attribute vec3 aN;
      attribute vec2 aUV;
      attribute float aSeed;
      uniform sampler2D uTex;
      uniform float uTime, uViewH;
      varying vec3 vCol;
      varying float vA, vBig;
      void main(){
        vec3 col = texture2D(uTex, aUV).rgb;
        float lum = dot(col, vec3(0.3, 0.59, 0.11));
        float s = aSeed * 6.2831;
        vec3 p = position + aN * (lum * 5.0 + sin(uTime * 0.4 + s) * 0.5);
        p += vec3(sin(uTime * 0.13 + s), cos(uTime * 0.11 + s * 1.3), 0.0) * 0.25;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float d = max(1.0, -mv.z);
        float world = 0.07 + lum * 0.3;
        gl_PointSize = clamp(world * projectionMatrix[1][1] * uViewH * 0.5 / d, 1.0, 14.0);
        vBig = smoothstep(0.35, 0.8, lum);
        // Goldstich, damit die Stadt zur Seite passt.
        vCol = mix(col, col * vec3(1.08, 0.94, 0.74), 0.4) * 1.1;
        // Nur wirklich Helles wird zum Punkt; der dunkle Grund bleibt leer.
        vA = smoothstep(0.1, 0.5, lum) * 0.85 * (0.75 + 0.25 * sin(uTime * (0.7 + aSeed) + s * 5.0));
      }`,
    fragmentShader: `
      uniform float uVis;
      varying vec3 vCol;
      varying float vA, vBig;
      void main(){
        vec2 c = gl_PointCoord * 2.0 - 1.0;
        float r = length(c);
        if(r > 1.0) discard;
        float a = mix(exp(-r * r * 3.5),
                      smoothstep(1.0, 0.78, r) * (0.5 + 0.5 * smoothstep(0.45, 0.9, r)), vBig);
        gl_FragColor = vec4(vCol, a * vA * uVis);
      }`,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  });
  const sheet = new Points(geo, mat);
  sheet.frustumCulled = false;
  sheet.renderOrder = -2;
  sheet.visible = false;

  // Der weiche, helle Schein hinter dem Turm - in der Referenz das, was die
  // Punktwelt zusammenhaelt.
  const c2 = document.createElement('canvas');
  c2.width = c2.height = 128;
  const x2 = c2.getContext('2d');
  const g2 = x2.createRadialGradient(64, 64, 0, 64, 64, 64);
  g2.addColorStop(0, 'rgba(255,238,205,0.6)');
  g2.addColorStop(0.4, 'rgba(255,196,120,0.16)');
  g2.addColorStop(1, 'rgba(0,0,0,0)');
  x2.fillStyle = g2; x2.fillRect(0, 0, 128, 128);
  const shine = new Sprite(new SpriteMaterial({
    map: new CanvasTexture(c2), blending: AdditiveBlending, transparent: true,
    depthWrite: false, opacity: 0,
  }));
  shine.position.set(TOWER_AT.x, TOWER_AT.y + 3, TOWER_AT.z - 8);
  shine.scale.set(30, 24, 1);
  shine.renderOrder = -1;
  shine.visible = false;

  return { rt, scene: sc, cam, lights, beacon, sky, sheet, shine, tower: null, frame: 0 };
}

// Der Turm im "Video": dasselbe Modell, aber flach leuchtend - unten von
// Scheinwerfern angestrahlt, dazu das Funkeln, das der echte Turm zur vollen
// Stunde zeigt.
function addParisTower(model){
  if(!paris || paris.tower) return;
  const mat = new ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec3 vW;
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vW;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main(){
        float h = clamp(vW.y / ${TOWER_HEIGHT.toFixed(1)}, 0.0, 1.0);
        vec3 c = vec3(1.0, 0.6, 0.2) * (0.45 + 0.7 * (1.0 - h) * (1.0 - h) + 0.35 * h);
        float sp = step(0.985, hash(floor(vW * 9.0) + floor(uTime * 4.0)));
        gl_FragColor = vec4(c + sp * vec3(1.0, 0.95, 0.85) * 1.6, 1.0);
      }`,
  });
  const t = model.clone();
  t.traverse(o => { if(o.isMesh) o.material = mat; });
  paris.scene.add(t);
  paris.tower = t;
  paris.towerMat = mat;
}

function renderParis(t){
  const p = paris;
  // Die Kamera zieht langsam um die Stadt, hoch ueber den Daechern - der Turm
  // steht links im Bild, die Lichter der Stadt fuellen den Rest.
  const a = 2.2 + t * (Math.PI * 2 / 110);
  p.cam.position.set(Math.sin(a) * 30, 8.5 + Math.sin(t * 0.09) * 1.5, Math.cos(a) * 30);
  // Etwas rechts am Turm vorbei schauen: er steht dann im linken Drittel.
  p.cam.lookAt(Math.cos(a) * 7, 4, -Math.sin(a) * 7);
  // Der Schein liegt am Horizont hinter der Stadt, nicht mitten in ihr -
  // sonst hellt er den Boden auf und jeder Punkt des Feldes leuchtet.
  p.sky.position.set(-Math.sin(a) * 170, 4, -Math.cos(a) * 170);
  p.lights.material.uniforms.uTime.value = t;
  p.beacon.rotation.y = t * (Math.PI * 2 / 16);
  if(p.towerMat) p.towerMat.uniforms.uTime.value = t;
  renderer.setRenderTarget(p.rt);
  renderer.render(p.scene, p.cam);
  renderer.setRenderTarget(null);
}

/* --------------------------------------------------------------- Ablauf  */

// Der Lichthof: ein weicher Verlauf, additiv - Schwarz am Rand ist also
// unsichtbar. Am hellsten ist er dort, wo der Reif liegt (knapp unter der
// halben Breite); die Mitte bleibt zurueckhaltend, sonst fuellt er den Ring
// wie eine Muenze und das L verliert seinen Kontrast.
function makeHalo(){
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0,    'rgba(200,130,50,0.14)');
  g.addColorStop(0.32, 'rgba(235,158,60,0.34)');
  g.addColorStop(0.46, 'rgba(255,186,90,0.62)');
  g.addColorStop(0.6,  'rgba(215,128,36,0.24)');
  g.addColorStop(0.8,  'rgba(140,70,14,0.06)');
  g.addColorStop(1,    'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  const s = new Sprite(new SpriteMaterial({
    map: tex, blending: AdditiveBlending, transparent: true,
    depthWrite: false, opacity: 0,
  }));
  s.renderOrder = -1;
  return s;
}

// Die Reise des Emblems, als Tabelle statt als Trigonometrie: pro Stützstelle
// der Scroll-Fortschritt und wo der Ring dann steht. Dazwischen wird weich
// interpoliert. So lässt sich jede Szene einzeln nachjustieren, ohne dass
// eine Sinuskurve alle anderen mitverbiegt.
// top: hochkant (Handy) in den freien Streifen oben ausweichen, weil der
// Text dort oben beginnt. 0 = bleibt, 1 = weicht aus.
//        p     scale     x      y      z     rotX   rotY   rotZ   top
const KEYS = [
  [0.00, 0.40,  0.00,  1.30,  0.00,  0.12,  0.00,  0.00,  0],  // Eintritt - gross und mittig, unter der Kopfleiste
  [0.11, 0.54,  0.00,  1.05, -2.60,  0.12,  0.00,  0.00,  0],  // Das Wort - mittig, sinkt ein Stueck
  [0.25, 0.54,  0.00,  0.75, -2.80,  0.12,  0.00,  0.00,  0],  // Methode  - weiter hinab
  [0.32, 0.30,  0.00,  0.10, -3.60,  0.12,  0.00,  0.00,  0],  // sinkt, waehrend der Flug beginnt
  [0.55, 0.05,  0.00, -2.60, -6.50,  0.12,  0.00,  0.00,  0],  // Turm     - geparkt, ohnehin unsichtbar
  [0.80, 0.14,  0.00, -3.10, -3.80,  0.12,  0.00,  0.00,  0],  // taucht unter dem Turm wieder auf
  [0.90, 0.50,  0.00,  0.45, -2.90,  0.12,  0.00,  0.00,  1],  // Atelier  - mittig
  [1.00, 0.37,  0.00,  0.95, -0.15,  0.12,  0.00,  0.00,  0],  // Abschluss- wie im Startbild (naeher an der Kamera)
];
function smoothstep(t){ return t * t * (3 - 2 * t); }
function sampleKeys(p, out){
  let i = 0;
  while(i < KEYS.length - 2 && p > KEYS[i + 1][0]) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const t = smoothstep(Math.max(0, Math.min(1, (p - a[0]) / (b[0] - a[0]))));
  for(let k = 1; k < a.length; k++) out[k - 1] = a[k] + (b[k] - a[k]) * t;
  return out;
}

let renderer, scene, camera, clock, composer, bloom, grade;
let streaks;
let emblem, ringMain, tower, towerMats = [], emblemMats = [];
let raf = 0, running = false, lite = false, ready = false;
let progress = 0, shown = 0;
let spin = 0, spinT = 0;
let towerAmt = 0, towerShown = 0, tourP = 0, tourShown = 0;
let streakAmt = 0, parisVis = 0;
let halo, dust, paris = null;
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
  // Mit Bloom wird undurchsichtig gerendert: ein Nachbearbeitungspass und ein
  // durchscheinender Kanal vertragen sich schlecht. Der Grund kommt deshalb
  // aus der Seite (--bg) - optisch derselbe Ton, nur eben deckend.
  if(opts.bg) scene.background = new Color(opts.bg);
  camera = new PerspectiveCamera(42, 1, 0.1, 140);
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
    ? new MeshStandardMaterial({ color: GOLD, metalness: 1, roughness: 0.11, envMapIntensity: 2.4, transparent: true })
    : new MeshPhysicalMaterial({
        color: 0xffffff, metalness: 0, roughness: 0.028,
        transmission: 1, thickness: 0.10, ior: 1.42,
        attenuationColor: new Color(0xb2660b), attenuationDistance: 0.028,
        emissive: new Color(GOLD), emissiveIntensity: 0.24,
        specularColor: new Color(CHAMPAGNE), specularIntensity: 1,
        // Kraeftiges Irisieren: beim Drehen wandert ein Schimmer ueber die
        // Kante, wie das verchromte Zeichen in der Referenz.
        iridescence: 0.92, iridescenceIOR: 1.38, iridescenceThicknessRange: [180, 760],
        clearcoat: 1, clearcoatRoughness: 0.03,
        envMapIntensity: 3.4, transparent: true,
      });

  const mainMat = glass();
  // Ein Reif mit Volumen statt einer gezogenen Linie: der dicke Querschnitt
  // bricht das Licht in einzelne Facetten, so dass man beim Drehen jederzeit
  // sieht, wo vorn und wo hinten ist.
  ringMain = new Mesh(new TorusGeometry(1.9, 0.168, lite ? 6 : 22, lite ? 96 : 340), mainMat);
  emblem.add(ringMain);

  // Das L sitzt als eigener, etwas dickerer Körper mittig im Ring.
  const letterMat = new MeshStandardMaterial({
    color: GOLD_BRIGHT, emissive: new Color(GOLD), emissiveIntensity: 0.2,
    metalness: 1, roughness: 0.075, envMapIntensity: 3.6, transparent: true,
  });
  const letter = makeLetterL(letterMat);
  letter.scale.setScalar(1.85);
  emblem.add(letter);
  emblem.userData.letter = letter;

  const ribbonMat = strandGlint(lite
    ? new MeshStandardMaterial({
        color: GOLD_BRIGHT, emissive: new Color(GOLD), emissiveIntensity: 0.12,
        metalness: 1, roughness: 0.08, envMapIntensity: 3, transparent: true })
    : new MeshPhysicalMaterial({
        color: GOLD_BRIGHT, emissive: new Color(GOLD), emissiveIntensity: 0.12,
        metalness: 1, roughness: 0.045, envMapIntensity: 3.6,
        clearcoat: 1, clearcoatRoughness: 0.02, transparent: true }));
  const helix = makeHelix(ribbonMat, lite);
  emblem.add(helix);
  // Der Staub an den Straengen haengt am Zeichen und dreht mit.
  dust = makeDust(helix.userData.curves);
  emblem.add(dust);

  // Ein zweiter, schmaler Reif dicht innen. Er sitzt eine Spur vor dem
  // grossen und gibt dem Zeichen eine zweite Ebene - ohne ihn sieht ein
  // einzelner Reif von vorn immer noch flach aus.
  const bandMat = new MeshStandardMaterial({
    color: GOLD_BRIGHT, emissive: new Color(GOLD), emissiveIntensity: 0.95,
    metalness: 1, roughness: 0.11, envMapIntensity: 2.7, transparent: true,
  });
  const band = new Mesh(new TorusGeometry(1.63, 0.042, lite ? 5 : 14, lite ? 72 : 240), bandMat);
  band.position.z = 0.06;
  emblem.add(band);

  // Ein duenner Reif, der im Takt atmet. Er liegt knapp ausserhalb des
  // grossen und leuchtet staerker als alles andere - im Nachgluehen wird
  // daraus ein weicher Puls statt einer harten Linie.
  const pulseMat = new MeshStandardMaterial({
    color: GOLD_BRIGHT, emissive: new Color(GOLD), emissiveIntensity: 0.5,
    metalness: 0.8, roughness: 0.22, transparent: true,
  });
  const pulse = new Mesh(new TorusGeometry(2.06, 0.019, lite ? 5 : 12, lite ? 80 : 260), pulseMat);
  emblem.add(pulse);
  emblem.userData.pulse = pulse;

  // Der Segmentreif laeuft aussen herum, dem grossen Reif entgegen.
  const segMat = new MeshStandardMaterial({
    color: GOLD_BRIGHT, emissive: new Color(GOLD), emissiveIntensity: 0.8,
    metalness: 1, roughness: 0.16, envMapIntensity: 2.2, transparent: true,
  });
  const segRing = makeSegmentRing(segMat, 2.34, lite ? 12 : 22, lite);
  emblem.add(segRing);
  emblem.userData.segRing = segRing;

  emblemMats = [mainMat, letterMat, ribbonMat, bandMat, pulseMat, segMat];

  /* --- Licht: warm von oben, Weinrot als Gegenlicht von unten -----------
     Die Reichweite muss den Turm mit abdecken (10 Einheiten hoch), deshalb
     stehen die Lampen weiter draussen als fuer das Emblem noetig waere. */
  scene.add(new AmbientLight(0xffe2ad, 0.6));
  const key  = new PointLight(GOLD_BRIGHT, 260, 90); key.position.set(9, 14, 12);   scene.add(key);
  const rim  = new PointLight(CHAMPAGNE,   120, 90); rim.position.set(-11, 3, 6);   scene.add(rim);
  const back = new PointLight(NIGHT_BLUE,  260, 90); back.position.set(-7, -6, -10); scene.add(back);
  const warm = new PointLight(AMBER_DEEP,  200, 90); warm.position.set(11, 1, -7);  scene.add(warm);

  /* --- Lichtschlieren und Nachglühen ------------------------------------ */
  streaks = makeStreaks();
  streaks.position.z = -2.5;
  scene.add(streaks);

  // Ein warmer Lichthof hinter dem Zeichen. Er steht immer zur Kamera und
  // haengt nicht an der Drehung - sonst saehe man ihn beim Umdrehen als
  // flache Scheibe von der Kante.
  halo = makeHalo();
  scene.add(halo);

  // Die Punktwelt auf dem Weg zum Turm (Paris bei Nacht, als Punkte).
  paris = makeParis();
  scene.add(paris.sheet);
  scene.add(paris.shine);

  // Der Bloom ist das, was die Referenz teuer macht: helle Stellen bluehen in
  // weiche Hoefe aus. Auf schwachen Geraeten faellt der Pass weg - dort wird
  // direkt gerendert.
  if(!lite){
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new Vector2(window.innerWidth, window.innerHeight),
                                0.42,   // Staerke
                                0.78,   // Radius - lieber weit und weich
                                0.80);  // Schwelle - nur wirklich Helles blueht
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    // Nach dem Farbraum, damit Korn und Vignette auf dem fertigen Bild
    // sitzen und nicht noch durch die Tonwertkurve gezogen werden.
    grade = new ShaderPass(GradeShader);
    composer.addPass(grade);
  }

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
  // Eine GANZE Umrundung: die Fahrt endet wieder auf der Seite, von der sie
  // kam, mit Blick in dieselbe Richtung. Nur so kann die Kamera danach
  // einfach zurueckweichen - nach einer halben Runde stuende sie hinter dem
  // Turm, mit dem Ruecken zum Zeichen, und muesste sich umdrehen.
  to:   { ang: Math.PI * 2 - 0.45, y: 2.1, dist: 9.4, look: 2.6 },  // am Fuss
};
const _camTour = new Vector3(), _lookTour = new Vector3(), _look = new Vector3();
const _dirA = new Vector3(), _dirB = new Vector3();
function tourCamera(q){
  const e = smoothstep(q);
  const ang  = TOUR.from.ang  + (TOUR.to.ang  - TOUR.from.ang)  * e;
  const y    = TOUR.from.y    + (TOUR.to.y    - TOUR.from.y)    * e;
  const dist = TOUR.from.dist + (TOUR.to.dist - TOUR.from.dist) * e;
  const look = TOUR.from.look + (TOUR.to.look - TOUR.from.look) * e;
  _camTour.set(Math.sin(ang) * dist, y, Math.cos(ang) * dist);
  _lookTour.set(0, look, 0);
}

/* Die Drehung kommt vom Scrollen, nicht von der Uhr: index.html meldet ueber
   setTurn(), wie viele Szenen man schon hinter sich hat (0 = Start, 1 = Das
   Wort, ...). Eine Szene ist eine volle Umdrehung - in jeder Szenenmitte
   steht das Zeichen also wieder genau von vorn, dazwischen dreht es sich.
   Im Stand dreht nichts, es schwebt nur. */
let turnTarget = 0, turnShown = 0;
function setTurn(t){ if(typeof t === 'number' && isFinite(t)) turnTarget = t; }


const _k = new Array(8);
function applyTransform(p, t){
  const k = sampleKeys(p, _k);
  // Die Kamera misst senkrecht. Auf einem hochkantigen Schirm würde der Ring
  // deshalb das ganze Bild füllen - dort fällt er entsprechend kleiner aus.
  const fit = Math.max(0.50, Math.min(1, camera.aspect / 1.35));
  // Das Emblem darf auf dem Handy nicht ganz so stark schrumpfen wie der
  // Turm - sonst bleibt von der Marke nur ein Fleck uebrig.
  const efit = Math.max(0.62, Math.min(1, camera.aspect / 1.35));
  emblem.scale.setScalar(k[0] * efit);
  // Die x/y der Tabelle sind fuer den Desktop gedacht. Auf einem schmalen
  // Schirm liegen sie ausserhalb des Bildes, deshalb werden sie auf den
  // tatsaechlich sichtbaren Rand zurueckgeholt - abzueglich des Reifs selbst.
  const dist  = Math.max(0.6, (7 - p * 1.2) - k[3]);
  const halfH = Math.tan((camera.fov * Math.PI / 180) / 2) * dist;
  const halfW = halfH * camera.aspect;
  const edge  = 1.9 * k[0] * efit + 0.18;
  const maxX  = Math.max(0, halfW - edge);
  const maxY  = Math.max(0, halfH - edge);
  // Hochkant gibt es neben dem Text keinen Platz. Stuetzstellen, die das
  // Emblem an die Seite stellen wollten (grosses |x|), ruecken dort in den
  // freien Streifen ueber dem Text; mittig gedachte bleiben, wo sie sind.
  // Seit Build 17 steht das Zeichen mittig (x = 0); welche Szene hochkant
  // nach oben ausweicht, sagt die letzte Spalte der Tabelle (top).
  const port = Math.max(0, Math.min(1, (1 - camera.aspect) / 0.45))
             * Math.max(Math.min(1, Math.abs(k[1]) / 2.2), k[7] || 0);
  const kx = k[1] * (1 - port);
  const ky = k[2] + (halfH * 0.62 - k[2]) * port;
  emblem.position.set(Math.max(-maxX, Math.min(maxX, kx)),
                      Math.max(-maxY, Math.min(maxY, ky)), k[3]);
  // Der Zeiger kippt das Emblem nur leicht mit - genug, dass es auf die Maus
  // reagiert, zu wenig, um die inszenierte Bahn zu überschreiben.
  emblem.rotation.set(k[4] + Math.sin(t * 0.25) * 0.03,
                      k[5] + spin,
                      k[6] + Math.sin(t * 0.19) * 0.04);
  // Im Stand nur ein leises Schweben - die Drehung gehoert dem Scroll.
  emblem.position.y += Math.sin(t * 0.85) * 0.14 * k[0] * efit;
  // Das L dreht dem Reif ein Stueck entgegen, damit es nicht wie aufgeklebt
  // mitfaehrt, sondern wie ein eigener Koerper im Ring schwebt.
  // Das L dreht nicht ganz mit: Reif und Straenge sind nach einer halben
  // Drehung wieder dieselbe Form, das L waere gespiegelt. Es neigt sich nur
  // bis etwa 20 Grad mit und schaut sonst immer nach vorn.
  if(emblem.userData.letter){
    emblem.userData.letter.rotation.y = -spin + Math.sin(spin) * 0.35 + Math.sin(t * 0.35) * 0.06;
  }
  // Drei Ebenen mit eigenem Takt: der grosse Reif dreht langsam im
  // Uhrzeigersinn, der Segmentreif schneller dagegen, der duenne Reif atmet.
  if(ringMain) ringMain.rotation.z = -t * (Math.PI * 2 / 20);
  if(emblem.userData.segRing) emblem.userData.segRing.rotation.z = t * (Math.PI * 2 / 12);
  if(emblem.userData.pulse){
    const beat = 1 + 0.04 - Math.cos(t * (Math.PI * 2 / 2.5)) * 0.04;
    emblem.userData.pulse.scale.setScalar(beat);
    emblem.userData.pulse.material.emissiveIntensity = 0.42 + (beat - 1) * 9;
  }
  // Das Glanzlicht braucht 6 Sekunden fuer einen Strang.
  glint.value = t / 6;
  camera.position.z = 7 - p * 1.2;

  // Überblendung. Der Turm steigt beim Auftritt leicht an und dreht sich
  // langsam, damit das Gitterwerk aus allen Richtungen Licht fängt.
  const tw = towerShown;
  // Das Emblem begleitet die ganze Reise. Nur der Turm schickt es von der
  // Buehne - danach kommt es unterhalb von ihm wieder herein.
  // Die Kamera fliegt am Zeichen vorbei; es tritt dabei zurueck, statt ihr
  // als grosser Fleck durchs Bild zu fahren.
  const eo = 1 - smoothstep(Math.max(0, Math.min(1, (tw - 0.08) / 0.42)));
  // Die Schlieren teilen sich das Schicksal des Emblems und ziehen am Anfang
  // und am Ende der Reise am kraeftigsten - dort, wo sonst nur Grund waere.
  const ends = Math.max(1 - p / 0.16, (p - 0.86) / 0.14);
  streakAmt = eo * (0.5 + 0.3 * Math.max(0, Math.min(1, ends)));
  emblem.visible = eo > 0.01;
  for(const m of emblemMats) m.opacity = eo;
  if(dust) dust.material.uniforms.uOpacity.value = eo;
  // Die Schlieren kreisen um das Zeichen und liegen dahinter.
  streaks.position.set(emblem.position.x, emblem.position.y, emblem.position.z - 1.6);
  streakFront = emblem.position.z;
  streakClear = 2.4 * emblem.scale.x;          // Radius des Segmentreifs
  if(halo){
    const es = emblem.scale.x;
    halo.visible = eo > 0.01;
    halo.position.set(emblem.position.x, emblem.position.y, emblem.position.z - 0.9);
    // Atmet ganz leicht mit dem duennen Reif.
    const breath = 1 + Math.sin(t * (Math.PI * 2 / 2.5) - Math.PI / 2) * 0.03;
    halo.scale.setScalar(es * 8.4 * breath);
    halo.material.opacity = 0.46 * eo;
  }

  if(tower){
    tower.visible = tw > 0.01;
    if(tower.visible){
      // Auf einem hochkantigen Schirm faellt der Turm schmaler aus, sonst
      // passt er nicht zwischen Kopfleiste und Kaertchen.
      tower.scale.setScalar(fit);
      tower.position.set(TOWER_AT.x, TOWER_AT.y - TOWER_HEIGHT * 0.5 * fit, TOWER_AT.z);
      // Taucht am Horizont auf, sobald die Fahrt beginnt - aus der Ferne
      // ist das ein Auftauchen, kein Ueberblenden.
      const app = smoothstep(Math.min(1, tw * 4));
      for(const m of towerMats) m.opacity = app;
      // Funkeln: ein ruhiges Pulsieren, kein Stroboskop.
      tower.userData.sparks.material.opacity =
        (0.3 + 0.6 * (0.5 + 0.5 * Math.sin(t * 2.1))) * app;
      // Der Scheinwerfer kreist in 16 Sekunden einmal.
      const beacon = tower.userData.beacon;
      if(beacon){
        beacon.rotation.y = t * (Math.PI * 2 / 16);
        beacon.userData.mat.uniforms.uOpacity.value = 0.42 * app;
      }
    }
  }

  // Die Kamera: vor dem Zeichen steht sie still und driftet nur, am Turm
  // faehrt sie um ihn herum. Dazwischen FLIEGT sie - Position und Blick
  // werden entlang des Scrolls von der einen Einstellung zur anderen
  // gefuehrt, durch das Punktfeld hindurch. Kein Ueberblenden, kein
  // Einrasten: man ist einfach irgendwann da.
  tourCamera(tourShown);
  // Hochkant ist der Turm kleiner (fit). Die Hoehen der Fahrt muessen mit
  // schrumpfen, sonst schaut die Kamera ueber die Spitze hinweg ins Leere.
  _camTour.y *= fit; _lookTour.y *= fit;
  const yOff = -TOWER_HEIGHT * 0.5 * fit;
  const ez = 7 - p * 1.2;
  // Anfahren und Abbremsen weich (smootherstep), dazwischen zuegig.
  const b = tw * tw * tw * (tw * (tw * 6 - 15) + 10);
  // Ein Driften, das nie aufhoert: selbst wenn niemand scrollt, atmet das
  // Bild. Drei Perioden ohne gemeinsamen Teiler, damit sich die Bahn nicht
  // hoerbar wiederholt. Waehrend der Turmfahrt faellt es weg - dort fuehrt
  // die Kamerafahrt, und ein zweiter Impuls wuerde sie nur verwackeln.
  const idle = 1 - b;
  const dx = Math.sin(t * 0.11) * 0.2  * idle;
  const dy = Math.sin(t * 0.083) * 0.15 * idle;
  const dz = Math.sin(t * 0.061) * 0.28 * idle;
  // Unterwegs ein leichter Bogen nach oben - ein Flug, keine Schiene.
  const arc = Math.sin(Math.PI * b) * 1.6;
  const tx = TOWER_AT.x + _camTour.x, ty = TOWER_AT.y + _camTour.y + yOff, tz = TOWER_AT.z + _camTour.z;
  camera.position.set(dx + (tx - dx) * b,
                      dy + (ty - dy) * b + arc,
                      ez + dz + (tz - ez - dz) * b);
  // Die BLICKRICHTUNG wird ueberblendet, nicht der Blickpunkt: unterwegs
  // kaeme die Kamera ihrem eigenen Zielpunkt sonst so nahe, dass sie sich
  // wild wegdreht. Vorn der Blick aufs Zeichen (mit 35 % des Driftens, das
  // gibt die Parallaxe), hinten der Blick der Turmfahrt.
  _dirA.set(dx * 0.35 - dx, dy * 0.35 - dy, -(ez + dz)).normalize();
  _dirB.set(_lookTour.x - _camTour.x, _lookTour.y - _camTour.y, _lookTour.z - _camTour.z).normalize();
  _dirA.lerp(_dirB, b).normalize();
  _look.copy(camera.position).addScaledVector(_dirA, 10);
  camera.lookAt(_look);
  // Die Punktwelt zeigt sich nur auf dem Weg: sie kommt mit dem Flug und
  // geht, sobald die Umrundung beginnt (dort saehe man sie von der Seite).
  // Nach der ganzen Runde steht die Kamera wieder davor - beim Zurueck-
  // weichen ist sie also wieder da.
  if(paris){
    const mid = Math.min(tourShown, 1 - tourShown);
    parisVis = smoothstep(Math.max(0, Math.min(1, (b - 0.06) / 0.4)))
             * (1 - smoothstep(Math.max(0, Math.min(1, mid / 0.07))));
    paris.sheet.visible = paris.shine.visible = parisVis > 0.005;
    paris.sheet.material.uniforms.uVis.value = parisVis;
    paris.shine.material.opacity = 0.32 * parisVis;
  }
}

function frame(){
  if(!running){ raf = 0; return; }
  const dtRaw = clock.getDelta();
  const dt = Math.min(dtRaw, 0.05);          // fuer Bewegung: begrenzt den Sprung
  const t = clock.elapsedTime;

  // Ueberblendungen muessen an der echten Zeit haengen, nicht an der Bildrate.
  // Mit `min(1, dt * k)` und gedeckeltem dt lief eine Ueberblendung pro BILD
  // ab: bei 60 Bildern/s war der Turm nach einer Sekunde weg, bei 2 Bildern/s
  // erst nach fuenf - auf schwachen Geraeten stand er also noch mitten in der
  // naechsten Szene. Die Exponentialform braucht immer gleich lang.
  const smooth = (k) => 1 - Math.exp(-k * Math.min(dtRaw, 0.25));

  shown      += (progress - shown)      * smooth(3.2);
  // Zuegig ausblenden: der Turm soll weg sein, bevor die naechste Szene steht.
  // Kurz nachziehen gegen Mausrad-Stufen, mehr nicht - die Fahrt haengt
  // am Scroll. Laengeres Nachlaufen fuehlte sich wie Einrasten an.
  towerShown += (towerAmt - towerShown) * smooth(10);
  tourShown  += (tourP    - tourShown)  * smooth(8);
  px += (pointerX - px) * smooth(2.4);
  py += (pointerY - py) * smooth(2.4);
  // Weich nachziehen, damit ein Mausrad-Sprung nicht als Ruck dreht.
  turnShown += (turnTarget - turnShown) * smooth(5);
  spin = turnShown * Math.PI;
  if(grade) grade.uniforms.uTime.value = t;
  if(dust) dust.material.uniforms.uTime.value = t;
  if(paris) paris.sheet.material.uniforms.uTime.value = t;
  applyTransform(shown, t);
  // Die Schlieren gehen mit dem Emblem: waehrend der Turm die Buehne hat,
  // sollen sie nicht durch sein Gitterwerk ziehen.
  updateStreaks(streaks, t, dt, streakAmt);
  // Das "Video" nur rendern, solange man es sieht - auf schwachen Geraeten
  // jedes zweite Bild, das faellt bei der Punktgroesse nicht auf.
  if(paris && parisVis > 0.005 && (!lite || (paris.frame++ & 1) === 0)) renderParis(t);

  draw();
  raf = requestAnimationFrame(frame);
}

function draw(){
  if(composer) composer.render();
  else renderer.render(scene, camera);
}

function resize(){
  if(!ready) return;
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  if(composer) composer.setSize(w, h);
  if(bloom) bloom.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  // Punktgroessen in Geraetepixeln, auf die Bildhoehe bezogen - sonst
  // waeren die Punkte auf einem grossen Schirm winzig.
  const pr = renderer.getPixelRatio();
  if(dust) dust.material.uniforms.uPx.value = (h / 900) * pr;
  if(paris) paris.sheet.material.uniforms.uViewH.value = h * pr;
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
  turnShown = turnTarget; spin = turnShown * Math.PI;   // Standbild folgt dem Scroll direkt
  applyTransform(shown, 0);
  updateStreaks(streaks, 0, 0, streakAmt * 0.5);
  if(paris && parisVis > 0.005) renderParis(0);
  draw();
}

window.LumiereGL = { init, start, stop, resize, setProgress, setTower, setPointer, setTurn,
  renderOnce, loadTower,
  get ready(){ return ready; },
  get hasTower(){ return !!tower; } };
