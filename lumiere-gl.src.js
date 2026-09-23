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
  ConeGeometry, ShaderMaterial, Sprite, SpriteMaterial, WebGLRenderTarget, VideoTexture,
  ACESFilmicToneMapping, SRGBColorSpace, AdditiveBlending,
  TextureLoader, InstancedMesh, Object3D, PlaneGeometry, LinearFilter,
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
  const tubular = lite ? 72 : 200, radial = lite ? 5 : 8, thick = 0.03;   // seit Build 27 zarter
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
    totalEmissiveRadiance += vec3(1.0, 0.86, 0.58) * g * 1.9;
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

/* ------------------------------------------ Das Startbild (ab Build 27) -- */

// Lorbeerkranz um das Emblem, wie in der Referenz: zwei Zweige, die sich
// unten kreuzen und an beiden Seiten hinaufwachsen. Die Blaetter sind EIN
// InstancedMesh (ein Draw-Call fuer alle), die Stiele zwei duenne Roehren.
// Er haengt am Emblem und dreht also mit.
const LAUREL_R = 2.95;
function makeLaurel(mat, lite){
  const g = new Group();
  // Blatt: lanzettlich, Spitze nach +y, Ansatz im Ursprung. Flach extrudiert
  // mit kleiner Fase - die Fase faengt das Licht, sonst waere es ein Scherenschnitt.
  const L = 1, W = 0.24;
  const sh = new Shape();
  sh.moveTo(0, 0);
  sh.quadraticCurveTo(W, L * 0.42, 0, L);
  sh.quadraticCurveTo(-W, L * 0.42, 0, 0);
  const leafGeo = new ExtrudeGeometry(sh, {
    depth: 0.018, bevelEnabled: !lite, bevelThickness: 0.012, bevelSize: 0.012,
    bevelSegments: 1, curveSegments: lite ? 4 : 8,
  });
  leafGeo.translate(0, 0, -0.009);
  // Winkel auf dem Kreis (0 = rechts, gegen den Uhrzeigersinn). Der rechte
  // Zweig beginnt links unter der Mitte (dort kreuzen sich die Stiele) und
  // endet oben rechts; der linke ist sein Spiegelbild.
  const A0 = -Math.PI / 2 - 0.22, A1 = Math.PI * 0.36;
  const per = lite ? 10 : 13;
  const dummy = new Object3D();
  const mats = [];
  for(const side of [1, -1]){
    for(let i = 0; i < per; i++){
      const f = (i + 0.5) / per;
      const a = A0 + (A1 - A0) * f;
      const size = 0.78 - 0.4 * f;                        // zur Spitze kleiner
      for(const out of [1, -1]){
        const spread = 0.55;                              // Blatt gegen den Stiel
        // Tangente (Wuchsrichtung) und Normale (nach aussen) am Kreis.
        const tx = -Math.sin(a), ty = Math.cos(a);
        const nx = Math.cos(a), ny = Math.sin(a);
        const dx = tx * Math.cos(spread) + out * nx * Math.sin(spread);
        const dy = ty * Math.cos(spread) + out * ny * Math.sin(spread);
        const ang = Math.atan2(dy, dx) - Math.PI / 2;
        // Versatz entlang des Zweigs, damit aussen und innen nicht auf
        // derselben Hoehe sitzen - wie beim echten Lorbeer.
        const aa = a + (out > 0 ? 0 : 0.09);
        dummy.position.set(side * Math.cos(aa) * LAUREL_R, Math.sin(aa) * LAUREL_R, 0.06);
        dummy.rotation.set(0, 0, side > 0 ? ang : -ang);
        dummy.rotateY(side * out * 0.42);                 // leicht verkippt: Glanz wandert
        dummy.scale.set(size, size, 1);
        dummy.updateMatrix();
        mats.push(dummy.matrix.clone());
      }
    }
    // Stiel: vom Kreuzungspunkt bis kurz vor die Spitze.
    const pts = [];
    for(let k = 0; k <= 24; k++){
      const a = A0 - 0.12 + (A1 - A0 + 0.06) * (k / 24);
      pts.push(new Vector3(side * Math.cos(a) * LAUREL_R, Math.sin(a) * LAUREL_R, 0.06));
    }
    g.add(new Mesh(new TubeGeometry(new CatmullRomCurve3(pts), lite ? 40 : 90, 0.032, lite ? 4 : 6, false), mat));
  }
  const leaves = new InstancedMesh(leafGeo, mat, mats.length);
  mats.forEach((m, i) => leaves.setMatrixAt(i, m));
  leaves.instanceMatrix.needsUpdate = true;
  g.add(leaves);
  return g;
}

// Der Grund des Startbilds: dunkler Marmor mit Goldadern (marble.webp,
// prozedural erzeugt) und feine goldene Linienboegen in den Ecken. Ein
// bildschirmfuellendes Rechteck, das als Erstes gezeichnet wird. Die Boegen
// rechnet der Shader selbst - so bleiben sie auf jedem Schirm gestochen scharf.
// Ein Lichtschimmer laeuft langsam ueber die Adern. Sichtbar nur im Startbild
// (uAmt), danach wird es wieder Nacht.
function makeBackdrop(bg){
  const mat = new ShaderMaterial({
    uniforms: {
      uTex: { value: null }, uReady: { value: 0 }, uAmt: { value: 1 },
      uAspect: { value: 1 }, uTime: { value: 0 }, uShift: { value: 0 },
      uBg: { value: new Color(bg || 0x0a0d14) }, uPx: { value: 1 / 900 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }`,
    fragmentShader: `
      uniform sampler2D uTex;
      uniform float uReady, uAmt, uAspect, uTime, uShift, uPx;
      uniform vec3 uBg;
      varying vec2 vUv;
      // Ein Bogen: Abstand zum Kreis um c mit Radius r, als duenne Linie.
      float arc(vec2 p, vec2 c, float r, float w){
        float d = abs(length(p - c) - r);
        return smoothstep(w, 0.0, d);
      }
      void main(){
        // Seitenverhaeltnis: die quadratische Textur deckt den Schirm (cover).
        vec2 uv = vUv - 0.5;
        if(uAspect > 1.0) uv.y /= uAspect; else uv.x *= uAspect;
        uv += 0.5;
        uv.y += uShift * 0.35;                  // zieht beim Scrollen langsam mit
        vec3 m = texture2D(uTex, uv).rgb * 1.3;
        // Goldanteil der Adern: rot deutlich ueber blau.
        float gold = clamp((m.r - m.b) * 4.0, 0.0, 1.0);
        float sweep = vUv.x * 0.8 + vUv.y * 0.6 - fract(uTime * 0.045) * 2.4 + 0.4;
        m += m * gold * exp(-sweep * sweep / 0.012) * 2.2;
        // Linienboegen: Schirmkoordinaten mit echtem Seitenverhaeltnis.
        // Einheit = kuerzere Bildseite, damit die Boegen hochkant nicht
        // quer ueber den ganzen Schirm laufen, sondern in den Ecken bleiben.
        float k = min(1.0, uAspect);
        vec2 p = vec2((vUv.x - 0.5) * uAspect, vUv.y - 0.5) / k;
        float w = uPx * 1.1 / k;
        float ln = 0.0;
        float hx = 0.5 * uAspect / k, hy = 0.5 / k;
        // Buendel in der oberen rechten und unteren linken Ecke, je ein
        // einzelner Bogen in den anderen beiden - wie in der Referenz.
        ln += arc(p, vec2( hx + 0.05,  hy + 0.12), 0.42, w) * 0.9;
        ln += arc(p, vec2( hx + 0.10,  hy + 0.16), 0.50, w) * 0.65;
        ln += arc(p, vec2( hx + 0.02,  hy + 0.22), 0.55, w) * 0.5;
        ln += arc(p, vec2( hx + 0.18,  hy + 0.10), 0.60, w) * 0.35;
        ln += arc(p, vec2(-hx - 0.05, -hy - 0.12), 0.42, w) * 0.9;
        ln += arc(p, vec2(-hx - 0.10, -hy - 0.16), 0.50, w) * 0.65;
        ln += arc(p, vec2(-hx - 0.02, -hy - 0.22), 0.55, w) * 0.5;
        ln += arc(p, vec2(-hx - 0.18, -hy - 0.10), 0.60, w) * 0.35;
        ln += arc(p, vec2(-hx - 0.12,  hy + 0.20), 0.40, w) * 0.4;
        ln += arc(p, vec2( hx + 0.12, -hy - 0.20), 0.40, w) * 0.4;
        // Ein Lichtpunkt wandert die Boegen entlang.
        float trav = 0.5 + 0.5 * sin(atan(p.y, p.x) * 3.0 - uTime * 0.6);
        vec3 lineCol = vec3(0.86, 0.62, 0.3) * (0.5 + 0.9 * pow(trav, 6.0));
        vec3 col = m + lineCol * ln * 0.55;
        // Nach unten hin geht der Marmor in die Nacht ueber.
        float fadeY = smoothstep(-0.15, 0.35, vUv.y + uShift * 0.9);
        float a = uAmt * uReady * fadeY;
        gl_FragColor = vec4(mix(uBg, col, a), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    depthTest: false, depthWrite: false,
  });
  const mesh = new Mesh(new PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -100;
  return mesh;
}
function loadMarble(url){
  if(!url || !backdrop) return;
  new TextureLoader().load(url, (tex) => {
    tex.colorSpace = SRGBColorSpace;
    tex.minFilter = LinearFilter; tex.generateMipmaps = false;
    const u = backdrop.material.uniforms;
    u.uTex.value = tex;
    // Weich einblenden statt aufploppen.
    heroFadeIn = 0.0001;
  });
}

// Goldwellen: zwei Baender aus Goldstaub, die vom Zeichen nach links und
// rechts wegziehen, wie in der Referenz. Jedes Korn liegt auf einer von drei
// Wellen je Seite und wandert langsam nach aussen; die ganze Bewegung rechnet
// der Grafikchip, im JS passiert pro Bild nichts ausser der Uhrzeit.
function makeWaves(lite){
  const n = lite ? 2200 : 6000;
  const aU = new Float32Array(n), aSide = new Float32Array(n), aStrand = new Float32Array(n);
  const aOff = new Float32Array(n * 2), aSeed = new Float32Array(n), aSize = new Float32Array(n);
  for(let i = 0; i < n; i++){
    aU[i] = Math.random();
    aSide[i] = i & 1 ? 1 : -1;
    aStrand[i] = Math.floor(Math.random() * 5);
    // Quer zur Welle: die meisten Koerner sitzen auf feinen Fasern (wie
    // Seidenfaeden), der Rest als weicher Dunst drumherum.
    const spread = Math.random() < 0.7 ? 0.08 : 1.5;
    aOff[i * 2] = gauss() * spread;
    aOff[i * 2 + 1] = gauss() * spread;
    aSeed[i] = Math.random();
    aSize[i] = Math.random() < 0.05 ? 3 + Math.random() * 3 : 0.9 + Math.random() * 1.6;
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('aU', new Float32BufferAttribute(aU, 1));
  geo.setAttribute('aSide', new Float32BufferAttribute(aSide, 1));
  geo.setAttribute('aStrand', new Float32BufferAttribute(aStrand, 1));
  geo.setAttribute('aOff', new Float32BufferAttribute(aOff, 2));
  geo.setAttribute('aSeed', new Float32BufferAttribute(aSeed, 1));
  geo.setAttribute('aSize', new Float32BufferAttribute(aSize, 1));
  const mat = new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uVis: { value: 1 }, uPx: { value: 1 }, uReach: { value: 14 } },
    vertexShader: `
      attribute float aU, aSide, aStrand, aSeed, aSize;
      attribute vec2 aOff;
      uniform float uTime, uPx, uReach;
      varying float vA;
      varying vec3 vCol;
      void main(){
        float u = fract(aU + uTime * 0.012 * (0.55 + aSeed * 0.9));
        float ph = aStrand * 0.55 + aSide * 0.9;
        float amp = 0.5 + u * 2.6;
        // Welle: vom Reif aus erst sacht hinab, dann in weiten Boegen nach
        // aussen und zu den oberen Ecken hinauf - wie in der Referenz. Die
        // Fasern liegen dicht beieinander und faechern nach aussen auf.
        float x = aSide * (2.4 + u * uReach);
        float y = sin(u * 3.4 + ph + uTime * 0.21) * amp * 0.55
                + sin(u * 1.6 - ph * 0.4 + uTime * 0.12) * amp * 0.3
                - 0.25 - sin(u * 3.14159) * 0.9 + u * u * 3.2
                + (aStrand - 2.0) * 0.26 * (0.25 + u * 1.8);
        float thick = 0.1 + u * 1.1;
        vec3 p = vec3(x, y + aOff.x * thick, -0.8 + aOff.y * thick * 0.8);
        // Leichtes Flirren um den eigenen Platz.
        float s = aSeed * 6.2831;
        p += vec3(sin(uTime * 0.7 + s), cos(uTime * 0.5 + s * 1.3), 0.0) * 0.05 * (0.4 + u);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float fade = smoothstep(0.0, 0.07, u) * (1.0 - smoothstep(0.62, 1.0, u));
        float core = exp(-dot(aOff, aOff) * 40.0);
        float tw = 0.65 + 0.35 * sin(uTime * (1.2 + aSeed * 2.0) + s * 5.0);
        vA = fade * tw * (0.45 + 1.1 * core) * (aSize > 3.0 ? 0.55 : 1.0);
        vCol = mix(vec3(0.72, 0.45, 0.16), vec3(1.0, 0.86, 0.56), core * 0.8 + 0.2 * tw);
        gl_PointSize = aSize * uPx * 7.0 / max(0.5, -mv.z);
      }`,
    fragmentShader: `
      uniform float uVis;
      varying float vA;
      varying vec3 vCol;
      void main(){
        vec2 c = gl_PointCoord - 0.5;
        float d = dot(c, c) * 4.0;
        if(d > 1.0) discard;
        float a = (1.0 - d) * (1.0 - d) * vA * uVis;
        gl_FragColor = vec4(vCol * a, a);
      }`,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  });
  const pts = new Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 2;
  return pts;
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

// Das Funkeln: Punkte im Volumen des Turms, die einzeln und kurz aufblitzen -
// wie das Glitzern zur vollen Stunde in Paris (seit Build 27 je Punkt eigener
// Takt statt eines gemeinsamen Pulsierens, mit kleinem Lichtkreuz).
function towerHalf(h, height){ return (0.34 * Math.pow(1 - h, 1.85) + 0.02) * height; }
function makeSparks(height, lite){
  const count = lite ? 260 : 700;
  const pos = new Float32Array(count * 3), seed = new Float32Array(count);
  for(let i = 0; i < count; i++){
    const h = Math.random();
    // Die Breite folgt grob dem Umriss, damit die Funken auf dem Bauwerk
    // sitzen und nicht daneben in der Luft.
    const w = towerHalf(h, height) * (0.4 + Math.random() * 0.9);
    const a = Math.random() * Math.PI * 2;
    pos[i * 3]     = Math.cos(a) * w;
    pos[i * 3 + 1] = h * height;
    pos[i * 3 + 2] = Math.sin(a) * w;
    seed[i] = Math.random();
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new Float32BufferAttribute(seed, 1));
  const mat = new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uPx: { value: 1 } },
    vertexShader: `
      attribute float aSeed;
      uniform float uTime, uPx;
      varying float vA, vF;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        // Kurzer, heller Blitz, danach lange Ruhe.
        float f = pow(max(0.0, sin(uTime * (1.1 + aSeed * 2.4) + aSeed * 60.0)), 22.0);
        vF = f;
        vA = 0.18 + f * 1.6;
        gl_PointSize = (1.6 + 7.0 * f) * uPx * 9.0 / max(0.5, -mv.z);
      }`,
    fragmentShader: `
      uniform float uOpacity;
      varying float vA, vF;
      void main(){
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c) * 2.0;
        float core = smoothstep(1.0, 0.0, d);
        // Lichtkreuz nur beim Aufblitzen.
        float cross = (max(0.0, 1.0 - abs(c.x) * 16.0) * max(0.0, 1.0 - abs(c.y) * 2.2)
                     + max(0.0, 1.0 - abs(c.y) * 16.0) * max(0.0, 1.0 - abs(c.x) * 2.2)) * vF;
        float a = (core * core + cross * 0.8) * vA * uOpacity;
        gl_FragColor = vec4(vec3(1.0, 0.93, 0.76) * a, a);
      }`,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  });
  return new Points(geo, mat);
}

// Glut und Glitter: Funken steigen am Turm auf und verwehen, oben rieselt
// Goldglitter herab. Alles im Shader, pro Bild nur die Uhrzeit.
function makeEmbers(height, lite){
  const n = lite ? 420 : 1300;
  const start = new Float32Array(n * 3), seed = new Float32Array(n), kind = new Float32Array(n);
  for(let i = 0; i < n; i++){
    const fall = Math.random() < 0.38;
    const h = fall ? 0.55 + Math.random() * 0.5 : Math.pow(Math.random(), 1.4) * 0.8;
    const w = towerHalf(Math.min(h, 1), height) * (0.6 + Math.random() * 0.8) + 0.2;
    const a = Math.random() * Math.PI * 2;
    start[i * 3] = Math.cos(a) * w;
    start[i * 3 + 1] = h * height;
    start[i * 3 + 2] = Math.sin(a) * w;
    seed[i] = Math.random();
    kind[i] = fall ? 1 : 0;
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(start, 3));
  geo.setAttribute('aSeed', new Float32BufferAttribute(seed, 1));
  geo.setAttribute('aKind', new Float32BufferAttribute(kind, 1));
  const mat = new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uPx: { value: 1 } },
    vertexShader: `
      attribute float aSeed, aKind;
      uniform float uTime, uPx;
      varying float vA;
      varying vec3 vCol;
      void main(){
        float speed = mix(0.07, 0.11, aSeed);
        float life = fract(uTime * speed + aSeed * 7.0);
        vec3 p = position;
        float s = aSeed * 6.2831;
        if(aKind < 0.5){
          // Glut: steigt auf, treibt nach aussen, taumelt.
          p.y += life * 3.2;
          p.xz *= 1.0 + life * 0.35;
          p.x += sin(uTime * 1.3 + s * 3.0) * 0.18 * life;
          p.z += cos(uTime * 1.1 + s * 2.0) * 0.18 * life;
          vCol = mix(vec3(1.0, 0.55, 0.16), vec3(1.0, 0.82, 0.45), aSeed);
        }else{
          // Glitter: rieselt in Schlangenlinien herab.
          p.y -= life * 5.0;
          p.x += sin(life * 9.0 + s) * 0.25;
          p.z += cos(life * 7.0 + s) * 0.25;
          vCol = vec3(1.0, 0.92, 0.7);
        }
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float tw = aKind > 0.5 ? pow(0.5 + 0.5 * sin(uTime * 9.0 + s * 20.0), 3.0) : 0.7 + 0.3 * sin(uTime * 5.0 + s);
        vA = sin(3.14159 * life) * tw;
        gl_PointSize = (aKind > 0.5 ? 2.2 : 2.8) * uPx * 9.0 / max(0.5, -mv.z);
      }`,
    fragmentShader: `
      uniform float uOpacity;
      varying float vA;
      varying vec3 vCol;
      void main(){
        vec2 c = gl_PointCoord - 0.5;
        float d = dot(c, c) * 4.0;
        if(d > 1.0) discard;
        float a = (1.0 - d) * (1.0 - d) * vA * uOpacity;
        gl_FragColor = vec4(vCol * a, a);
      }`,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  });
  const pts = new Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

// Der Lichtfaden: windet sich auf derselben Bahn wie die Kamera um den Turm,
// nur enger, und waechst mit der Fahrt. Sein Kopf laeuft der Kamera ein
// Stueck voraus - so fuehrt er den Blick von Karte zu Karte.
const TRAIL_LEAD = 0.07;
function makeTrail(height, lite){
  const pts = [];
  const N = 160;
  for(let i = 0; i <= N; i++){
    const q = i / N;
    const e = smoothstep(q);
    const ang = TOUR.from.ang + (TOUR.to.ang - TOUR.from.ang) * e + 0.5;
    const y = TOUR.from.y + (TOUR.to.y - TOUR.from.y) * e + 0.4;
    const r = towerHalf(Math.max(0, Math.min(1, y / height)), height) + 1.25;
    pts.push(new Vector3(Math.sin(ang) * r, y, Math.cos(ang) * r));
  }
  const curve = new CatmullRomCurve3(pts);
  const tub = lite ? 260 : 600, rad = lite ? 4 : 6;
  const geo = new TubeGeometry(curve, tub, 0.028, rad, false);
  const along = new Float32Array((tub + 1) * (rad + 1));
  for(let r = 0; r <= tub; r++) for(let j = 0; j <= rad; j++) along[r * (rad + 1) + j] = r / tub;
  geo.setAttribute('aAlong', new Float32BufferAttribute(along, 1));
  const mat = new ShaderMaterial({
    uniforms: { uReveal: { value: 0 }, uOpacity: { value: 0 }, uTime: { value: 0 } },
    vertexShader: `
      attribute float aAlong;
      varying float vAlong;
      void main(){ vAlong = aAlong; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uReveal, uOpacity, uTime;
      varying float vAlong;
      void main(){
        float on = smoothstep(uReveal + 0.004, uReveal - 0.004, vAlong);
        if(on <= 0.0) discard;
        float head = exp(-pow((vAlong - uReveal) / 0.012, 2.0));
        // Hinter dem Kopf verblasst der Faden langsam, ganz weg ist er nie.
        float tail = 0.28 + 0.72 * smoothstep(uReveal - 0.35, uReveal, vAlong);
        // Kleine Lichtpakete laufen den Faden entlang.
        float pulse = 0.6 + 0.4 * pow(0.5 + 0.5 * sin(vAlong * 90.0 - uTime * 4.0), 6.0);
        vec3 col = vec3(1.0, 0.7, 0.28) * tail * pulse + vec3(1.0, 0.95, 0.8) * head * 3.0;
        gl_FragColor = vec4(col * on * uOpacity, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  });
  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.userData.curve = curve;
  // Der Kopf als weicher Lichtpunkt.
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,245,215,1)'); gr.addColorStop(0.25, 'rgba(255,200,110,.55)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const tex = new CanvasTexture(c); tex.colorSpace = SRGBColorSpace;
  const headS = new Sprite(new SpriteMaterial({ map: tex, blending: AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
  headS.scale.setScalar(0.9);
  mesh.userData.head = headS;
  return mesh;
}

// Feuerwerk: drei Garben, kurz nacheinander, wenn die letzte Karte erreicht
// ist. Jede Garbe ist ein Satz Punkte mit eigener Richtung; Flugbahn,
// Schwerkraft und Verloeschen rechnet der Shader aus der Startzeit.
// Die Startpunkte werden beim Zuenden gesetzt (fireworks()), passend zur
// Blickrichtung der Kamera - sonst gingen die Garben hinter den Karten auf.
const FW_ORIGINS = [new Vector3(), new Vector3(), new Vector3()];
function makeFireworks(lite){
  const per = lite ? 200 : 480, n = per * 3;
  const dir = new Float32Array(n * 3), burst = new Float32Array(n), seed = new Float32Array(n);
  for(let i = 0; i < n; i++){
    const b = Math.floor(i / per);
    // Gleichmaessig auf der Kugel, mit etwas Streuung in der Weite.
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    const sp = 0.75 + Math.random() * 0.35;
    dir[i * 3] = Math.cos(a) * r * sp; dir[i * 3 + 1] = u * sp; dir[i * 3 + 2] = Math.sin(a) * r * sp;
    burst[i] = b; seed[i] = Math.random();
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(dir, 3));
  geo.setAttribute('aBurst', new Float32BufferAttribute(burst, 1));
  geo.setAttribute('aSeed', new Float32BufferAttribute(seed, 1));
  const mat = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uPx: { value: 1 }, uOpacity: { value: 1 }, uR: { value: 3 },
      uStart: { value: new Vector3(-99, -99, -99) },
      uO0: { value: FW_ORIGINS[0] }, uO1: { value: FW_ORIGINS[1] }, uO2: { value: FW_ORIGINS[2] },
    },
    vertexShader: `
      attribute float aBurst, aSeed;
      uniform float uTime, uPx, uR;
      uniform vec3 uStart, uO0, uO1, uO2;
      varying float vA;
      varying vec3 vCol;
      void main(){
        float st = aBurst < 0.5 ? uStart.x : (aBurst < 1.5 ? uStart.y : uStart.z);
        vec3 o  = aBurst < 0.5 ? uO0 : (aBurst < 1.5 ? uO1 : uO2);
        float age = uTime - st;
        float life = 2.6;
        if(age < 0.0 || age > life){ gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vA = 0.0; return; }
        float R = uR * (aBurst < 0.5 ? 1.15 : 0.95);
        vec3 p = o + position * R * (1.0 - exp(-age * 2.4)) + vec3(0.0, -0.55 * age * age, 0.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float k = age / life;
        // Zum Ende hin knistern die Funken, bevor sie verloeschen.
        float crackle = k > 0.6 ? step(0.5, fract(sin(aSeed * 91.7 + floor(uTime * 14.0)) * 43758.5)) : 1.0;
        vA = pow(1.0 - k, 1.4) * crackle * (1.0 + 2.0 * exp(-age * 6.0));
        vec3 c0 = vec3(1.0, 0.8, 0.4), c1 = vec3(1.0, 0.93, 0.78), c2 = vec3(1.0, 0.6, 0.25);
        vCol = aBurst < 0.5 ? c0 : (aBurst < 1.5 ? c1 : c2);
        gl_PointSize = (4.6 - k * 2.4) * uPx * 9.0 / max(0.5, -mv.z);
      }`,
    fragmentShader: `
      uniform float uOpacity;
      varying float vA;
      varying vec3 vCol;
      void main(){
        vec2 c = gl_PointCoord - 0.5;
        float d = dot(c, c) * 4.0;
        if(d > 1.0) discard;
        float a = (1.0 - d) * vA * uOpacity;
        gl_FragColor = vec4(vCol * a, a);
      }`,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  });
  const pts = new Points(geo, mat);
  pts.frustumCulled = false;
  pts.visible = false;
  return pts;
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
    // Build 27: Glut und Glitter, Lichtfaden, Feuerwerk mit Lichtblitz.
    const embers = makeEmbers(TOWER_HEIGHT, lite);
    g.add(embers);
    const trail = makeTrail(TOWER_HEIGHT, lite);
    g.add(trail); g.add(trail.userData.head);
    const fw = makeFireworks(lite);
    g.add(fw);
    const flash = new Sprite(trail.userData.head.material.clone());
    flash.scale.setScalar(9);
    flash.visible = false;
    g.add(flash);
    g.userData.embers = embers; g.userData.trail = trail; g.userData.fw = fw; g.userData.flash = flash;
    g.visible = false;
    scene.add(g);
    tower = g;
    towerMats = [mat];
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
  grid: () => (lite ? [128, 72] : [256, 144]),
  // Das Punktfeld: ein Stueck Zylindermantel hinter dem Turm, zur Flugbahn hin
  // gewoelbt. Mittelpunkt, Radius, Oeffnungswinkel, Hoehe.
  C: new Vector3(0, 3, -10), R: 50, ARC: 1.6, H: 44,
};

// Ein Vorhang aus Punkten, der seine Farben aus einer Textur liest (Video
// oder Render). Die Punkte liegen auf einem Stueck Zylindermantel, der zur
// Kamera hin gewoelbt ist; helle Stellen treten nach vorn und werden
// groesser, Dunkles bleibt leer. `gold` = 0: echte Farben mit Goldstich,
// 1: nur die Helligkeit zaehlt, gezeichnet in Gold (fuer Schwarz-Weiss).
function makeVideoSheet(o){
  const [gw, gh] = o.grid;
  const n = gw * gh;
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2), seed = new Float32Array(n);
  let q = 0;
  for(let j = 0; j < gh; j++){
    for(let i = 0; i < gw; i++, q++){
      const u = (i + 0.5 + (Math.random() - 0.5) * 0.8) / gw;
      const v = (j + 0.5 + (Math.random() - 0.5) * 0.8) / gh;
      const ang = (u - 0.5) * o.ARC;
      pos[q * 3]     = o.C.x + Math.sin(ang) * o.R;
      pos[q * 3 + 1] = o.C.y + (v - 0.5) * o.H;
      pos[q * 3 + 2] = o.C.z - Math.cos(ang) * o.R;
      // Nach innen, zur Kamera hin - dorthin treten helle Stellen vor.
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
      uTex: { value: o.tex || null }, uTime: { value: 0 }, uVis: { value: 0 },
      uViewH: { value: 900 }, uGold: { value: o.gold || 0 },
      uPush: { value: o.push || 5 },
      uLo: { value: o.lo != null ? o.lo : 0.1 }, uHi: { value: o.hi || 0.5 },
      uGain: { value: o.gain || 1.1 },
      // Auf schwachen Geraeten gibt es weniger Punkte und kein Nachgluehen -
      // dort werden sie groesser und kraeftiger, sonst sieht man nichts.
      uSize: { value: lite ? 1.6 : 1 }, uBoost: { value: lite ? 1.7 : 1 },
      uFront: { value: o.front != null ? o.front : 1.2 },
    },
    vertexShader: `
      attribute vec3 aN;
      attribute vec2 aUV;
      attribute float aSeed;
      uniform sampler2D uTex;
      uniform float uTime, uViewH, uGold, uPush, uLo, uHi, uGain, uSize, uBoost, uFront;
      varying vec3 vCol;
      varying float vA, vBig;
      void main(){
        vec3 col = texture2D(uTex, aUV).rgb;
        float lum = dot(col, vec3(0.3, 0.59, 0.11));
        float s = aSeed * 6.2831;
        vec3 p = position + aN * (uFront + lum * uPush + sin(uTime * 0.4 + s) * 0.5);
        p += vec3(sin(uTime * 0.13 + s), cos(uTime * 0.11 + s * 1.3), 0.0) * 0.25;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float d = max(1.0, -mv.z);
        float world = (0.07 + lum * 0.3) * uSize;
        gl_PointSize = clamp(world * projectionMatrix[1][1] * uViewH * 0.5 / d, 1.0, 14.0);
        vBig = smoothstep(0.35, 0.8, lum);
        // Leichter Goldstich, damit es zur Seite passt - oder ganz in Gold.
        vec3 tint = mix(col, col * vec3(1.08, 0.94, 0.74), 0.4) * uGain;
        vec3 gold = mix(vec3(0.62, 0.32, 0.08), vec3(1.0, 0.76, 0.42), lum) * (0.35 + lum * 1.1);
        vCol = mix(tint, gold, uGold);
        // Nur wirklich Helles wird zum Punkt; der dunkle Grund bleibt leer.
        vA = min(1.0, smoothstep(uLo, uHi, lum) * 0.85 * uBoost) * (0.75 + 0.25 * sin(uTime * (0.7 + aSeed) + s * 5.0));
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
  // Hinter den Punkten das Video selbst - weich, leicht golden, mit
  // ausgeblendeten Raendern. So erkennt man es gut, und die Punkte schweben
  // davor wie in der Referenz. Das Bild haengt als Kind am Punktvorhang:
  // sichtbar genau dann, wenn er es ist, und mit denselben Uniforms.
  sheet.add(makeVideoPlane(o, mat.uniforms));
  return sheet;
}

function makeVideoPlane(o, U){
  const cols = 48;
  const pos = [], uv = [], idx = [];
  for(let i = 0; i <= cols; i++){
    const u = i / cols, ang = (u - 0.5) * o.ARC;
    for(let j = 0; j <= 1; j++){
      pos.push(o.C.x + Math.sin(ang) * o.R, o.C.y + (j - 0.5) * o.H, o.C.z - Math.cos(ang) * o.R);
      uv.push(u, j);
    }
    if(i < cols){
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mat = new ShaderMaterial({
    uniforms: {
      uTex: U.uTex, uVis: U.uVis, uGold: U.uGold, uGain: U.uGain,
      uPlane: { value: o.plane != null ? o.plane : 0.5 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D uTex;
      uniform float uVis, uGold, uGain, uPlane;
      varying vec2 vUv;
      void main(){
        // Fuenf Abtastungen: ein Hauch Weichzeichnung, damit das Video
        // hinter den Punkten liegt statt mit ihnen zu konkurrieren.
        vec2 d = vec2(1.6 / 320.0, 1.6 / 180.0);
        vec3 c = texture2D(uTex, vUv).rgb * 0.4
               + (texture2D(uTex, vUv + vec2(d.x, 0.0)).rgb + texture2D(uTex, vUv - vec2(d.x, 0.0)).rgb
                + texture2D(uTex, vUv + vec2(0.0, d.y)).rgb + texture2D(uTex, vUv - vec2(0.0, d.y)).rgb) * 0.15;
        // Steile Tonwertkurve: Dunkles wird schwarz, nur Lichter und
        // Konturen bleiben. Ohne sie legte sich das Video wie ein milchiger
        // Schleier ueber die ganze Nacht.
        c = max(c - 0.05, 0.0);
        c = c * c * 2.4;
        float lum = dot(c, vec3(0.3, 0.59, 0.11));
        vec3 tint = mix(c, c * vec3(1.08, 0.94, 0.74), 0.4) * uGain;
        vec3 gold = mix(vec3(0.62, 0.32, 0.08), vec3(1.0, 0.76, 0.42), min(1.0, lum * 1.5)) * lum * 1.8;
        vec3 col = mix(tint, gold, uGold);
        // Raender weich ausblenden - kein Rechteck im Raum.
        float e = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x)
                * smoothstep(0.0, 0.24, vUv.y) * smoothstep(1.0, 0.76, vUv.y);
        gl_FragColor = vec4(col, e * uVis * uPlane);
      }`,
    transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
  });
  const m = new Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = -3;
  return m;
}

/* ------------------------------------------------------------ Videos  */

// Zwei kurze Schleifen (Pexels, freie Lizenz), auf 320 x 180 verkleinert:
// die Seine-Bruecke fuer den Weg zum Turm, die Strassenbahn fuer das
// Hinabsinken. Jede liegt als MP4 (H.264, fuer Safari/iPhone) und als WebM
// (VP9) vor; genommen wird, was der Browser kann. Abgespielt wird nur,
// solange man die Punkte sieht - sonst steht das Video.
let videoUrls = null;
const videos = {};
function setVideos(urls){ videoUrls = urls || null; }
function makeVideo(base){
  const el = document.createElement('video');
  el.muted = true; el.defaultMuted = true; el.loop = true; el.playsInline = true;
  el.setAttribute('muted', ''); el.setAttribute('playsinline', ''); el.setAttribute('webkit-playsinline', '');
  el.preload = 'auto';
  // Safari (iPhone/iPad) dekodiert ein Video, das nirgends im Dokument haengt,
  // teils gar nicht - dann bliebe die Textur leer. Deshalb haengt es winzig und
  // unsichtbar mit im Dokument (nicht display:none, das haelt Safari ebenfalls an).
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = 'position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1;';
  document.body.appendChild(el);
  const v = { el, tex: null, ready: false, failed: false, blocked: false, playing: false };
  el.addEventListener('loadeddata', () => { v.ready = true; });
  el.addEventListener('error', () => { v.failed = true; });
  const mp4 = el.canPlayType('video/mp4; codecs="avc1.4D401E"');
  const url = base.replace(/\.mp4(\?|$)/, mp4 ? '.mp4$1' : '.webm$1');
  el.src = url;
  el.load();
  const tex = new VideoTexture(el);
  tex.colorSpace = SRGBColorSpace;
  v.tex = tex;
  return v;
}
// Abspielen, solange man es sieht. Lehnt der Browser ab (iPhone im
// Stromsparmodus spielt nichts automatisch ab), bleibt es beim Ersatz.
function driveVideo(v, want){
  if(!v || v.failed) return;
  if(want && !v.playing && !v.blocked){
    v.playing = true;
    const pr = v.el.play();
    if(pr && pr.catch) pr.catch(() => { v.playing = false; v.blocked = true; });
  }else if(!want && v.playing){
    v.el.pause();
    v.playing = false;
  }
}
function videoUsable(v){ return !!(v && v.ready && !v.failed && !v.blocked); }

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

  // Der Punktvorhang in der Hauptszene. Er liest zuerst aus dem Render;
  // sobald das Seine-Video laeuft, aus dem Video (siehe frame()).
  const sheet = makeVideoSheet({
    grid: PARIS.grid(), C: PARIS.C, R: PARIS.R, ARC: PARIS.ARC, H: PARIS.H,
    tex: rt.texture, gold: 0, plane: 0.62,
  });

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
  [0.00, 0.30,  0.00,  1.28,  0.00,  0.12,  0.00,  0.00,  0],  // Eintritt - oben mittig mit Kranz, der Text hat Platz (Build 27)
  [0.11, 0.54,  0.00,  1.05, -2.60,  0.12,  0.00,  0.00,  0],  // Das Wort - mittig, sinkt ein Stueck
  [0.25, 0.54,  0.00,  0.75, -2.80,  0.12,  0.00,  0.00,  0],  // Methode  - weiter hinab
  [0.32, 0.30,  0.00,  0.10, -3.60,  0.12,  0.00,  0.00,  0],  // sinkt, waehrend der Flug beginnt
  [0.55, 0.05,  0.00, -2.60, -6.50,  0.12,  0.00,  0.00,  0],  // Turm     - geparkt, ohnehin unsichtbar
  [0.80, 0.14,  0.00, -3.10, -3.80,  0.12,  0.00,  0.00,  0],  // taucht unter dem Turm wieder auf
  [0.90, 0.50,  0.00,  0.45, -2.90,  0.12,  0.00,  0.00,  1],  // Atelier  - mittig
  [1.00, 0.21,  0.00,  1.30, -0.15,  0.12,  0.00,  0.00,  1],  // Abschluss- wie im Startbild: oben, "Kostenlos starten" darunter (Build 27)
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
let halo, dust, paris = null, tramSheet = null, tramVis = 0;
let backdrop = null, waves = null, heroT = 0, heroShown = 0, heroFadeIn = 0;
let pxScale = 1, fwStage = 0, fwFlashT = -99;
// Drei Garben kurz nacheinander, dazu ein Lichtblitz und ein Signal an die
// Seite (fuer den Klang).
function fireworks(fu, t, radius, flashAt){
  fu.uStart.value.set(t, t + 0.45, t + 0.95);
  fu.uR.value = radius;
  fwFlashT = t;
  if(tower && tower.userData.flash) tower.userData.flash.position.copy(flashAt);
  try{ window.dispatchEvent(new CustomEvent('lumiere:firework')); }catch(e){}
}
let pointerX = 0, pointerY = 0, px = 0, py = 0;

function init(canvas, opts){
  if(ready) return true;
  opts = opts || {};
  lite = !!opts.lite;
  try{
    renderer = new WebGLRenderer({ canvas, antialias: !lite, alpha: true, powerPreference: lite ? 'low-power' : 'high-performance' });
  }catch(e){ return false; }
  if(!renderer.getContext()) return false;

  // Startwert; die Qualitaetsregelung passt ihn danach an das Geraet an.
  prNow = Math.min(window.devicePixelRatio || 1, lite ? 1.5 : 2);
  renderer.setPixelRatio(prNow);
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

  // Der Lorbeerkranz (Build 27) - aussen um alles, dreht mit.
  const laurelMat = new MeshStandardMaterial({
    color: GOLD_BRIGHT, emissive: new Color(GOLD), emissiveIntensity: 0.32,
    metalness: 1, roughness: 0.2, envMapIntensity: 2.5, transparent: true, side: DoubleSide,
  });
  emblem.add(makeLaurel(laurelMat, lite));

  emblemMats = [mainMat, letterMat, ribbonMat, bandMat, pulseMat, segMat, laurelMat];

  // Startbild: Marmorgrund und Goldwellen (Build 27).
  backdrop = makeBackdrop(opts.bg);
  scene.add(backdrop);
  loadMarble(opts.marble);
  waves = makeWaves(lite);
  scene.add(waves);

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
  // Die Strassenbahn aus Punkten, ganz schwach hinter dem Zeichen, waehrend
  // man von "Das Wort" zur Methode hinabsinkt - wie der Wald in der Referenz.
  tramSheet = makeVideoSheet({
    grid: lite ? [96, 54] : [192, 108],
    C: new Vector3(0, 0.5, 20), R: 40, ARC: 1.1, H: 24, gold: 1, push: 2.5, lo: 0.06, hi: 0.4, plane: 0.42,
  });
  scene.add(tramSheet);

  // Der Bloom ist das, was die Referenz teuer macht: helle Stellen bluehen in
  // weiche Hoefe aus. Seit Build 19 auch auf Handy und iPad - die
  // Qualitaetsregelung (governor) schaltet ihn ab, falls das Geraet es nicht
  // fluessig schafft.
  {
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
// Wie weit das Startbild schon weggescrollt ist, in Bildschirmhoehen
// (0 = ganz oben, 1 = eine Hoehe weiter). Treibt Marmor und Goldwellen.
function setHero(v){ if(typeof v === 'number' && isFinite(v)) heroT = Math.max(0, v); }

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
  // Startbild: 1 ganz oben, 0 nach etwa einer Bildschirmhoehe.
  const hv = 1 - smoothstep(Math.max(0, Math.min(1, heroShown / 0.9)));
  // Die Schlieren teilen sich das Schicksal des Emblems und ziehen am Anfang
  // und am Ende der Reise am kraeftigsten - dort, wo sonst nur Grund waere.
  const ends = Math.max(1 - p / 0.16, (p - 0.86) / 0.14);
  streakAmt = eo * (0.5 + 0.3 * Math.max(0, Math.min(1, ends)));
  emblem.visible = eo > 0.01;
  for(const m of emblemMats) m.opacity = eo;
  // Im Startbild liegen Schlaufe und Staub hinter der Schrift - dort
  // treten sie zurueck (Build 27), damit der Text die Buehne hat.
  if(emblemMats[2]) emblemMats[2].opacity = eo * (1 - 0.5 * hv);
  if(dust) dust.material.uniforms.uOpacity.value = eo * (1 - 0.6 * hv);
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
    halo.material.opacity = 0.46 * eo * (1 - 0.35 * hv);
  }
  // Marmor und Goldwellen gehoeren zum Startbild und gehen mit ihm.
  if(backdrop){
    const u = backdrop.material.uniforms;
    u.uShift.value = heroShown;
    u.uAmt.value = 1 - smoothstep(Math.max(0, Math.min(1, (heroShown - 0.25) / 0.85)));
    u.uReady.value = heroFadeIn;
    backdrop.visible = u.uAmt.value * heroFadeIn > 0.002;
  }
  if(waves){
    // Zum Schluss ("Kostenlos starten") kehren die Goldwellen zurueck.
    const endV = smoothstep(Math.max(0, Math.min(1, (p - 0.94) / 0.06)));
    const wv = Math.max(hv, endV) * eo;
    waves.visible = wv > 0.01;
    if(waves.visible){
      const es = Math.max(0.05, emblem.scale.x);
      waves.position.set(emblem.position.x, emblem.position.y, emblem.position.z);
      waves.scale.setScalar(es);
      const u = waves.material.uniforms;
      u.uVis.value = wv;
      // Bis knapp ueber den Bildrand, egal wie breit der Schirm ist.
      u.uReach.value = Math.max(4, (halfW * 1.15) / es - 2.4);
    }
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
      // Funkeln: jeder Punkt blitzt fuer sich (Shader), hier nur die Staerke.
      const ud = tower.userData;
      const su = ud.sparks.material.uniforms;
      su.uTime.value = t; su.uOpacity.value = app; su.uPx.value = pxScale;
      const eu = ud.embers.material.uniforms;
      eu.uTime.value = t; eu.uOpacity.value = app * 0.9; eu.uPx.value = pxScale;
      // Der Lichtfaden waechst mit der Fahrt, sein Kopf laeuft voraus.
      const tu = ud.trail.material.uniforms;
      const reveal = Math.min(1, tourShown + TRAIL_LEAD);
      tu.uReveal.value = reveal; tu.uTime.value = t;
      tu.uOpacity.value = app * smoothstep(Math.min(1, tourShown / 0.04));
      ud.trail.userData.curve.getPointAt(reveal, ud.trail.userData.head.position);
      ud.trail.userData.head.material.opacity = tu.uOpacity.value * (0.8 + 0.2 * Math.sin(t * 6));
      // Feuerwerk, sobald die letzte Karte erreicht ist - einmal je Besuch.
      const fw = ud.fw, fu = fw.material.uniforms;
      fu.uTime.value = t; fu.uPx.value = pxScale; fu.uOpacity.value = app;
      // Erste Runde an der letzten Karte: links und rechts ueber den Karten,
      // wo die Kamera gerade hinschaut. Zweite Runde beim Zurueckweichen,
      // wenn der ganze Turm im Bild steht: ueber der Spitze.
      if(fwStage === 0 && tourShown > 0.8 && app > 0.5){
        fwStage = 1;
        const e = smoothstep(tourShown);
        const ang = TOUR.from.ang + (TOUR.to.ang - TOUR.from.ang) * e;
        const rx = Math.cos(ang), rz = -Math.sin(ang);          // rechts, von der Kamera aus
        const fx = -Math.sin(ang), fz = -Math.cos(ang);         // von der Kamera weg
        FW_ORIGINS[0].set(-rx * 3.8 + fx * 1.2, 5.3, -rz * 3.8 + fz * 1.2);
        FW_ORIGINS[1].set( rx * 3.9 + fx * 1.0, 5.8,  rz * 3.9 + fz * 1.0);
        FW_ORIGINS[2].set(-rx * 1.4 + fx * 2.4, 6.4, -rz * 1.4 + fz * 2.4);
        fireworks(fu, t, 2.9, FW_ORIGINS[0]);
      }else if(fwStage === 1 && tourShown > 0.96 && towerShown < towerAmt + 0.02 && towerAmt < 0.8){
        fwStage = 2;
        FW_ORIGINS[0].set(0, 11.6, 0);
        FW_ORIGINS[1].set(-2.2, 10.6, 0.8);
        FW_ORIGINS[2].set(2.3, 10.9, -0.8);
        fireworks(fu, t, 3.6, new Vector3(0, TOWER_HEIGHT * 0.99, 0));
      }
      if(tourShown < 0.55) fwStage = 0;
      fw.visible = t - fu.uStart.value.z < 2.8;
      const fa = Math.exp(-(t - fwFlashT) * 3.2);
      ud.flash.visible = fa > 0.02 && app > 0.01;
      ud.flash.material.opacity = fa * 1.3 * app;
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
  // Die Strassenbahn zeigt sich zwischen "Das Wort" und der Methode und ist
  // weg, bevor der Flug zum Turm beginnt.
  if(tramSheet){
    tramVis = smoothstep(Math.max(0, Math.min(1, (p - 0.04) / 0.07)))
            * (1 - smoothstep(Math.max(0, Math.min(1, (p - 0.26) / 0.05))))
            * (1 - b);
    const ok = videoUsable(videos.tram);
    tramSheet.visible = ok && tramVis > 0.005;
    tramSheet.material.uniforms.uVis.value = tramVis * 0.5;
  }
}

function frame(){
  if(!running){ raf = 0; return; }
  const dtRaw = clock.getDelta();
  governor(dtRaw);
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
  heroShown += (heroT - heroShown) * smooth(10);
  if(heroFadeIn > 0 && heroFadeIn < 1) heroFadeIn = Math.min(1, heroFadeIn + Math.min(dtRaw, 0.1) * 1.4);
  if(backdrop) backdrop.material.uniforms.uTime.value = t;
  if(waves) waves.material.uniforms.uTime.value = t;
  if(paris) paris.sheet.material.uniforms.uTime.value = t;
  if(tramSheet) tramSheet.material.uniforms.uTime.value = t;
  // Die Videos erst holen, wenn sie bald gebraucht werden: die Strassenbahn,
  // sobald man zu scrollen beginnt, die Seine zusammen mit dem Turm.
  if(videoUrls){
    if(!videos.tram && videoUrls.tram && progress > 0.01) videos.tram = makeVideo(videoUrls.tram);
    if(!videos.seine && videoUrls.seine && (tower || towerLoading)) videos.seine = makeVideo(videoUrls.seine);
  }
  applyTransform(shown, t);
  // Die Schlieren gehen mit dem Emblem: waehrend der Turm die Buehne hat,
  // sollen sie nicht durch sein Gitterwerk ziehen.
  updateStreaks(streaks, t, dt, streakAmt);
  // Das "Video" nur rendern, solange man es sieht - auf schwachen Geraeten
  // jedes zweite Bild, das faellt bei der Punktgroesse nicht auf.
  driveVideo(videos.tram, tramVis > 0.005);
  driveVideo(videos.seine, parisVis > 0.005);
  if(tramSheet && videos.tram) tramSheet.material.uniforms.uTex.value = videos.tram.tex;
  const seineOk = videoUsable(videos.seine);
  if(paris){
    const u = paris.sheet.material.uniforms;
    u.uTex.value = seineOk ? videos.seine.tex : paris.rt.texture;
    // Das Video ist dunkler als das Render (Nachtaufnahme, echte Farben) -
    // schon mittlere Helligkeit soll zum Punkt werden, sonst bleibt von der
    // Bruecke nur ein duennes Band.
    u.uLo.value = seineOk ? 0.05 : 0.1;
    u.uHi.value = seineOk ? 0.32 : 0.5;
    u.uGain.value = seineOk ? 1.5 : 1.1;
    // Weniger Vortreten: bei der Bruecke zaehlt die Form der Boegen, und die
    // zerfaellt, wenn helle Punkte weit vor die dunklen ruecken.
    u.uPush.value = seineOk ? 1.8 : 5;
    // Ohne Video bleibt es beim selbst gerenderten Paris.
    if(!seineOk && parisVis > 0.005 && (!lite || (paris.frame++ & 1) === 0)) renderParis(t);
  }

  draw();
  raf = requestAnimationFrame(frame);
}

function draw(){
  if(composer && bloomOn) composer.render();
  else renderer.render(scene, camera);
}

/* ---------------------------------------------- Qualitaetsregelung  */

// Ziel: 60 Bilder/s auf jedem Geraet, und dabei so schoen wie moeglich. Die
// Regelung misst laufend die echte Bildzeit. Wird es zu langsam, sinkt
// zuerst die Aufloesung (bis 1.0), dann faellt das Nachgluehen weg, dann
// sinkt die Aufloesung weiter. Ist Luft, geht es langsam wieder hinauf - aber
// nie ueber die Stufe, an der es zuletzt zu langsam wurde.
// In automatisierten Tests (navigator.webdriver) ist sie aus - die
// Testmaschine rendert ohne Grafikkarte und wuerde alles herunterregeln;
// mit ?gov=1 laesst sie sich dort trotzdem pruefen.
const PR_MAX = Math.min(window.devicePixelRatio || 1, 2);
const PR_MIN = 0.6;
let bloomOn = true;
let prNow = 1, prCeil = PR_MAX;
const gov = { on: !navigator.webdriver || /[?&]gov=1/.test(location.search),
              acc: 0, n: 0, good: 0, cool: 0 };
function setQuality(pr, bloomState){
  prNow = Math.max(PR_MIN, Math.min(prCeil, pr));
  renderer.setPixelRatio(prNow);
  if(composer) composer.setPixelRatio(prNow);
  bloomOn = !!composer && bloomState;
  resize();
}
function governor(dtRaw){
  if(!gov.on || dtRaw > 0.25) return;      // Tabwechsel, Ruckler beim Laden
  if(gov.cool > 0){ gov.cool--; return; }  // nach jeder Aenderung kurz warten
  gov.acc += dtRaw; gov.n++;
  if(gov.n < 40) return;
  const avg = gov.acc / gov.n;
  gov.acc = 0; gov.n = 0;
  if(avg > 1 / 52){
    gov.good = 0;
    // Zu langsam: diese Stufe merkt sich die Regelung als Obergrenze.
    prCeil = Math.max(PR_MIN, prNow * 0.98);
    if(prNow > 1.01)            setQuality(Math.max(1, prNow * 0.8), bloomOn);
    else if(bloomOn)            setQuality(prNow, false);
    else if(prNow > PR_MIN)     setQuality(prNow * 0.85, false);
    gov.cool = 20;
  }else if(avg < 1 / 58){
    // Drei gute Messungen in Folge: eine Stufe hinauf.
    if(++gov.good >= 3 && prNow < prCeil - 0.01){
      setQuality(prNow * 1.12, bloomOn);
      gov.good = 0; gov.cool = 20;
    }
  }else gov.good = 0;
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
  if(waves) waves.material.uniforms.uPx.value = (h / 900) * pr;
  pxScale = (h / 900) * pr;
  if(backdrop){
    backdrop.material.uniforms.uAspect.value = w / h;
    backdrop.material.uniforms.uPx.value = 1 / h;
  }
  if(paris) paris.sheet.material.uniforms.uViewH.value = h * pr;
  if(tramSheet) tramSheet.material.uniforms.uViewH.value = h * pr;
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
  heroShown = heroT; if(heroFadeIn > 0) heroFadeIn = 1;
  turnShown = turnTarget; spin = turnShown * Math.PI;   // Standbild folgt dem Scroll direkt
  applyTransform(shown, 0);
  updateStreaks(streaks, 0, 0, streakAmt * 0.5);
  if(paris && parisVis > 0.005 && !videoUsable(videos.seine)) renderParis(0);
  draw();
}

window.LumiereGL = { init, start, stop, resize, setProgress, setTower, setPointer, setTurn, setHero,
  renderOnce, loadTower, setVideos,
  get ready(){ return ready; },
  get hasTower(){ return !!tower; } };
