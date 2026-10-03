# Lumière - "Ouverture": Kino-Trailer (Build 30), gerendert aus FluidR3-Samples (MIT).
# Streicher-Ostinato, Blech, Pauken/Taiko, Chor, zwei grosse Schlaege, am Ende
# das Paris-Motiv am Klavier. Selbst komponiert; nur die Klaenge stammen aus dem
# Soundfont. Quelle der Samples: npm-Paket soundfont-for-samplers (FluidR3_GM,
# MIT, (c) Frank Wen). Holen:  npm pack soundfont-for-samplers && tar xzf soundfont-for-samplers-*.tgz
# Pfade per Umgebung:  SF=<.../package/FluidR3_GM>  OUT=<Zielordner>/
import numpy as np, subprocess, os, random, json
import imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()
SF = os.environ.get('SF', 'package/FluidR3_GM')
OUT = os.environ.get('OUT', './')
SR = 44100
random.seed(11); np.random.seed(11)
NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
_cache = {}

def sample(inst, midi):
    key = (inst, midi)
    if key in _cache: return _cache[key]
    name = NAMES[midi % 12] + str(midi // 12 - 1)
    path = f'{SF}/{inst}-mp3/{name}.mp3'
    raw = subprocess.run([FF, '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True).stdout
    a = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()
    idx = np.argmax(np.abs(a).max(axis=1) > 0.002)
    a = a[max(0, idx - 20):]
    a *= 0.2 / max(1e-4, np.abs(a).max())     # Soundfont-Pegel schwanken stark (Schlagwerk 0.9, Blaeser 0.2)
    _cache[key] = a
    return a

BPM = 100.0; BEAT = 60.0 / BPM; BAR = 4 * BEAT
TOTAL_BARS = 32
LOOP = TOTAL_BARS * BAR                 # 76.8 s
LEN = int((LOOP + 6.5) * SR)            # plus Nachhall
BUS = {}
def bus(name):
    if name not in BUS: BUS[name] = np.zeros((LEN, 2), np.float32)
    return BUS[name]

def sustain(a, dur):
    need = int(dur * SR)
    if len(a) >= need: return a[:need].copy()
    ls, le = int(0.7 * SR), min(int(2.5 * SR), len(a) - int(0.1 * SR))
    seg = a[ls:le]; xf = int(0.35 * SR)
    out = a[:le].copy()
    while len(out) < need:
        fade = np.linspace(0, 1, xf, dtype=np.float32)[:, None]
        tail = out[-xf:] * (1 - fade) + seg[:xf] * fade
        out = np.concatenate([out[:-xf], tail, seg[xf:]])
    return out[:need]

def lowpass_fft(x, fc):
    X = np.fft.rfft(x, axis=0)
    f = np.fft.rfftfreq(x.shape[0], 1 / SR)
    H = 1 / np.sqrt(1 + (f / fc) ** 4)
    return np.fft.irfft(X * H[:, None], n=x.shape[0], axis=0).astype(np.float32)

def highpass_fft(x, fc):
    X = np.fft.rfft(x, axis=0)
    f = np.fft.rfftfreq(x.shape[0], 1 / SR)
    H = 1 - 1 / np.sqrt(1 + (f / fc) ** 4)
    return np.fft.irfft(X * H[:, None], n=x.shape[0], axis=0).astype(np.float32)

def place(a, t, busn):
    i = int(max(0, t) * SR); b = bus(busn)
    j = min(LEN, i + len(a))
    if j > i: b[i:j] += a[:j - i]

def note(inst, midi, t, dur, vel=0.8, pan=0.0, busn=None, attack=0.0, release=0.3, sus=False, ramp=None, jit=0.004, off=0.0):
    a = sample(inst, midi)
    if off > 0:                          # langsamen Bogenansatz ueberspringen (Spiccato aus Legato-Samples)
        a = a[int(off * SR):]
        attack = max(attack, 0.006)
    if sus: a = sustain(a, dur + release)
    else: a = a[:min(len(a), int((dur + release) * SR))].copy()
    n = len(a)
    env = np.ones(n, np.float32)
    if attack > 0:
        k = min(n, int(attack * SR)); env[:k] = np.linspace(0, 1, k) ** 1.5
    if ramp:                             # Anschwellen/Abschwellen ueber die Notendauer
        k = min(n, int(dur * SR)); env[:k] *= np.linspace(ramp[0], ramp[1], k) ** 1.6
        env[k:] *= ramp[1] ** 1.6
    r0 = int(dur * SR)
    if r0 < n: env[r0:] *= np.linspace(1, 0, n - r0) ** 2
    a = a * env[:, None] * vel
    gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    a[:, 0] *= gl * 1.414; a[:, 1] *= gr * 1.414
    place(a, t + random.gauss(0, jit), busn or inst)

def boom(t, vel=1.0, f0=58, f1=27, dur=3.2):
    """Tiefer Trailer-Schlag: fallender Sinus + kurzer Knack (selbst erzeugt)."""
    n = int(dur * SR); tt = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-tt * 2.4)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-tt * 1.35) * (1 - np.exp(-tt * 900))
    click = np.random.randn(n) * np.exp(-tt * 60) * 0.25
    x = np.stack([s + click, s + click], 1).astype(np.float32) * vel * 0.55
    place(x, t, 'boom')

def rev_cymbal(t_end, dur=2.4, vel=0.5):
    a = sample('orchestra_kit', 57)[::-1].copy()
    n = min(len(a), int(dur * SR)); a = a[-n:]
    a *= (np.linspace(0, 1, n) ** 2.2)[:, None] * vel
    place(a, t_end - n / SR, 'perc')

def whoosh(t_end, dur=2.4, vel=0.35):
    """Rauschen, das bis zum Schlag anschwillt und heller wird."""
    n = int(dur * SR)
    x = np.random.randn(n, 2).astype(np.float32)
    x = highpass_fft(lowpass_fft(x, 6000), 300)
    x *= (np.linspace(0, 1, n) ** 3)[:, None] * vel * 0.08
    place(x, t_end - dur, 'fx')

# ------------------------------------------------------------ Harmonie
V = {
 'Dm':  (38, [50, 57, 62, 65]), 'Bb': (34, [50, 58, 62, 65]), 'F':  (41, [53, 57, 60, 65]),
 'C':   (36, [52, 55, 60, 64]), 'Gm': (43, [50, 55, 58, 62]), 'A':  (45, [52, 57, 61, 64]),
 'D':   (38, [50, 57, 62, 66]), 'A/C#': (37, [52, 57, 61, 64]), 'Bm': (35, [50, 54, 59, 62]),
 'G':   (43, [50, 55, 59, 62]), 'Em': (40, [52, 55, 59, 64]),
}
S1 = ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', 'A']
S3 = ['D', 'A/C#', 'Bm', 'G', 'D', 'A', 'G', 'A']
SONG = ([('I', c) for c in S1] + [('II', c) for c in S1] + [('III', c) for c in S3]
        + [('IV', c) for c in ['Bm', 'G', 'Em', 'A']] + [('V', c) for c in ['Dm', 'Bb', 'Gm', 'A']])
assert len(SONG) == TOTAL_BARS

# Thema (Horn, spaeter Trompete) - Moll, dann Dur
TH_MIN = [
 [(0, 62, 1.5), (1.5, 64, .5), (2, 65, 2)], [(0, 70, 3), (3, 69, 1)],
 [(0, 69, 1.5), (1.5, 67, .5), (2, 65, 1), (3, 64, 1)], [(0, 64, 3), (3, 60, 1)],
 [(0, 62, 1.5), (1.5, 64, .5), (2, 65, 1), (3, 69, 1)], [(0, 74, 3), (3, 72, 1)],
 [(0, 70, 2), (2, 67, 2)], [(0, 69, 4)],
]
TH_MAJ = [
 [(0, 66, 1.5), (1.5, 69, .5), (2, 74, 2)], [(0, 73, 3), (3, 69, 1)],
 [(0, 71, 1.5), (1.5, 73, .5), (2, 74, 1), (3, 78, 1)], [(0, 79, 3), (3, 78, .5), (3.5, 76, .5)],
 [(0, 78, 1.5), (1.5, 76, .5), (2, 74, 2)], [(0, 76, 2), (2, 73, 2)],
 [(0, 74, 1.5), (1.5, 76, .5), (2, 79, 2)], [(0, 81, 4)],
]
TH_IV = [[(0, 78, 3), (3, 76, 1)], [(0, 74, 2), (2, 71, 2)], [(0, 71, 1.5), (1.5, 74, .5), (2, 79, 2)], [(0, 76, 2), (2, 73, 2)]]
PARIS = [[(0, 77, 1.5), (1.5, 74, .5), (2, 69, 2)], [(0, 77, 1), (1, 74, 1), (2, 70, 2)],
         [(0, 79, 1.5), (1.5, 74, .5), (2, 70, 2)], [(0, 76, 1), (1, 73, 1), (2, 69, 2)]]

sec_bar = {}
for bi, (sec, cname) in enumerate(SONG):
    t0 = bi * BAR
    bass, voic = V[cname]
    k = sec_bar.get(sec, 0); sec_bar[sec] = k + 1
    last = (bi == 15)                     # Takt vor dem ersten grossen Schlag
    cut = t0 + 3.5 * BEAT if last else None   # Luft holen vor dem Schlag

    def ok(t):
        return cut is None or t < cut

    # --- Streicherflaeche
    sv = {'I': 0.22, 'II': 0.3, 'III': 0.42, 'IV': 0.45, 'V': 0.26}[sec]
    for m in voic:
        note('string_ensemble_1', m + 12, t0, BAR * (0.84 if last else 1.02), sv * (0.9 + 0.2 * random.random()),
             pan=random.uniform(-.5, .5), busn='strings', attack=0.5 if sec != 'I' else 1.0, release=1.2, sus=True)
    if sec in ('III', 'IV'):   # Oktave hoch, Tremolo
        for m in voic[1:]:
            note('tremolo_strings', m + 24, t0, BAR * 1.01, 0.18, pan=random.uniform(-.6, .6), busn='strings', attack=0.2, release=1.0, sus=True)
    if sec == 'II' and k >= 6:
        for m in voic[1:]:
            note('tremolo_strings', m + 24, t0, BAR * (0.84 if last else 1.0), 0.2, pan=random.uniform(-.6, .6), busn='strings',
                 release=0.4, sus=True, ramp=(0.2, 1.0))
    # --- Tiefe: Kontrabass / Posaune / Tuba
    if sec in ('I', 'V'):
        note('contrabass', bass, t0, BAR, 0.5, busn='low', attack=0.4, release=1.2, sus=True)
    else:
        note('contrabass', bass, t0, BAR * (0.84 if last else 1.0), 0.55, busn='low', attack=0.1, release=0.8, sus=True)
        lv = 0.34 if sec == 'II' else 0.5
        note('trombone', bass + 12, t0, BAR * (0.84 if last else 1.0), lv, pan=-0.25, busn='brass', attack=0.15, release=0.7, sus=True)
        note('tuba', bass, t0, BAR * (0.84 if last else 1.0), lv * 0.9, pan=0.1, busn='brass', attack=0.15, release=0.7, sus=True)
    # --- Ostinato (Spiccato: kurze Anrisse), 3+3+2
    if sec != 'V':
        acc = [1, .55, .6, 1, .55, .6, 1, .6]
        pat = [0, 0, 12, 0, 0, 12, 0, 7]
        for e in range(8):
            t = t0 + e * BEAT / 2
            if not ok(t): continue
            v = (0.62 if sec == 'I' else 0.72) * acc[e]
            note('cello', bass + 12 + pat[e], t, 0.15, v, pan=-0.35, busn='ost', release=0.07, jit=0.002, off=0.36)
            note('pizzicato_strings', bass + 12 + pat[e], t, 0.12, v * 0.45, pan=-0.2, busn='ost', release=0.08, jit=0.002)
        if sec in ('II', 'III', 'IV'):
            up = [voic[0] + 12, voic[0] + 12, voic[2] + 12, voic[0] + 12, voic[1] + 12, voic[0] + 12, voic[3] + 12, voic[1] + 12]
            for e in range(16):
                t = t0 + e * BEAT / 4
                if not ok(t): continue
                v = 0.42 * (1.0 if e % 4 == 0 else 0.6) * (1.15 if sec != 'II' else 1.0)
                note('viola', up[e % 8], t, 0.09, v, pan=0.35, busn='ost', release=0.06, jit=0.002, off=0.5)
    # --- Chor
    if (sec == 'I' and k >= 4) or sec != 'I':
        cv = {'I': 0.2, 'II': 0.26, 'III': 0.42, 'IV': 0.46, 'V': 0.22}[sec]
        for m in voic:
            note('pad_4_choir', m + 12, t0, BAR * (0.84 if last else 1.02), cv, pan=random.uniform(-.4, .4), busn='choir',
                 attack=0.6 if sec in ('I', 'V') else 0.25, release=1.4, sus=True)
    # --- Thema
    mel = None
    if sec == 'I' and k >= 4:
        for (b, m, d) in TH_MIN[k]:
            note('french_horn', m - 12, t0 + b * BEAT, d * BEAT, 0.42, pan=-0.1, busn='horn', attack=0.08, release=0.8, sus=True)
    if sec == 'II':
        for (b, m, d) in TH_MIN[k]:
            if not ok(t0 + b * BEAT): continue
            dd = min(d * BEAT, cut - (t0 + b * BEAT)) if cut else d * BEAT
            note('french_horn', m, t0 + b * BEAT, dd, 0.62, pan=-0.1, busn='horn', attack=0.05, release=0.8, sus=True)
            note('french_horn', m - 12, t0 + b * BEAT, dd, 0.4, pan=0.15, busn='horn', attack=0.05, release=0.8, sus=True)
            note('violin', m + 12, t0 + b * BEAT, dd, 0.26, pan=0.3, busn='strings', attack=0.06, release=0.8, sus=True, off=0.25)
    if sec in ('III', 'IV'):
        th = TH_MAJ[k] if sec == 'III' else TH_IV[k]
        for (b, m, d) in th:
            t = t0 + b * BEAT
            note('trumpet', m, t, d * BEAT, 0.55, pan=0.05, busn='mel', attack=0.03, release=0.9, sus=True)
            note('french_horn', m - 12, t, d * BEAT, 0.6, pan=-0.2, busn='horn', attack=0.04, release=0.9, sus=True)
            note('violin', m + 12, t, d * BEAT, 0.3, pan=0.35, busn='strings', attack=0.05, release=0.9, sus=True, off=0.25)
            note('violin', m, t, d * BEAT, 0.3, pan=-0.35, busn='strings', attack=0.05, release=0.9, sus=True, off=0.25)
    if sec == 'V':
        for (b, m, d) in PARIS[k]:
            note('acoustic_grand_piano', m, t0 + b * BEAT, d * BEAT, 0.5, pan=-0.05, busn='piano', release=1.4)
            note('acoustic_grand_piano', m - 12, t0 + b * BEAT + 0.01, d * BEAT, 0.2, pan=-0.05, busn='piano', release=1.4)
        for e in range(8):   # Harfe darunter, leise
            tones = sorted(set(m + 12 for m in voic))
            note('orchestral_harp', tones[[0, 1, 2, 3, 2, 1, 2, 3][e]], t0 + e * BEAT / 2, BEAT, 0.2, pan=0.35, busn='harp', release=1.0)
    # --- Blechakkorde
    if sec == 'II' and k in (3, 7):     # Stoesse im 3+3+2
        for e in (0, 3, 6):
            t = t0 + e * BEAT / 2
            if not ok(t): continue
            for m in voic:
                note('brass_section', m, t, 0.24, 0.5, pan=random.uniform(-.3, .3), busn='brass', release=0.25)
    if sec in ('III', 'IV'):
        for m in voic:
            note('brass_section', m, t0, BAR * 0.98, 0.3, pan=random.uniform(-.4, .4), busn='brass', attack=0.05, release=0.8, sus=True)
    # --- Schlagwerk
    if sec == 'I':
        if k in (0, 4): note('timpani', bass if bass >= 38 else bass + 12, t0, 2.0, 0.6, busn='drums', release=0.8)
        if k == 7:      # Paukenwirbel ins Thema
            for e in range(32):
                t = t0 + e * BAR / 32
                note('timpani', 45, t, 0.2, 0.18 + 0.7 * (e / 31) ** 2, busn='drums', release=0.15, jit=0.003)
            rev_cymbal(t0 + BAR, 2.2, 0.35)
    if sec == 'II':
        tp = [(0, 1.0, 36), (0.75, .45, 43), (1.5, .7, 38), (2, .9, 36), (2.75, .45, 43), (3, .8, 38), (3.5, .6, 43)]
        for (b, v, m) in tp:
            if ok(t0 + b * BEAT): note('taiko_drum', m, t0 + b * BEAT, 0.8, v * 0.9, pan=random.uniform(-.2, .2), busn='drums', release=0.3)
        note('timpani', bass if bass >= 38 else bass + 12, t0, 1.6, 0.55, busn='drums', release=0.6)
        if k in (0, 4): note('orchestra_kit', 57, t0, 3.0, 0.4, pan=-0.3, busn='perc', release=1.0)
        if k == 7:      # Wirbel, Anlauf, dann Stille vor dem Schlag
            for e in range(28):
                t = t0 + e * BEAT / 8
                note('orchestra_kit', 38, t, 0.12, 0.12 + 0.55 * (e / 27) ** 2, pan=0.15, busn='perc', release=0.08, jit=0.002)
            rev_cymbal(t0 + BAR, 2.4, 0.55)
            whoosh(t0 + BAR, 2.4, 0.45)
    if sec == 'III':
        for e in range(8):
            v = 0.95 if e in (0, 3, 6) else 0.5
            note('taiko_drum', 36 if e in (0, 3, 6) else 43, t0 + e * BEAT / 2, 0.8, v, pan=random.uniform(-.25, .25), busn='drums', release=0.3)
        for b in (0, 2): note('orchestra_kit', 35, t0 + b * BEAT, 1.0, 0.75, busn='drums', release=0.4)
        for b in (1, 3): note('orchestra_kit', 38, t0 + b * BEAT, 0.5, 0.45, pan=0.1, busn='perc', release=0.3)
        note('timpani', bass if bass >= 38 else bass + 12, t0, 1.6, 0.65, busn='drums', release=0.6)
        if k % 2 == 0: note('orchestra_kit', 57, t0, 3.0, 0.42 if k else 0.6, pan=0.3 if k % 4 else -0.3, busn='perc', release=1.0)
        if k == 7:
            for e in range(8, 16):
                note('taiko_drum', 43, t0 + e * BEAT / 4, 0.4, 0.3 + 0.05 * (e - 8), busn='drums', release=0.2)
    if sec == 'IV':
        for (b, v, m) in [(0, 1.0, 36), (1.5, .6, 43), (3, .75, 38)]:
            note('taiko_drum', m, t0 + b * BEAT, 0.8, v, busn='drums', release=0.3)
        note('orchestra_kit', 35, t0, 1.0, 0.7, busn='drums', release=0.4)
        note('orchestra_kit', 38, t0 + 2 * BEAT, 0.5, 0.42, pan=0.1, busn='perc', release=0.3)
        if k == 0: note('orchestra_kit', 57, t0, 3.0, 0.5, pan=-0.3, busn='perc', release=1.0)
        if k == 3:
            rev_cymbal(t0 + BAR, 2.4, 0.45); whoosh(t0 + BAR, 2.0, 0.3)
    # --- Grosse Schlaege: Beginn Hoehepunkt (Takt 16) und Ausklang (Takt 28)
    if bi in (16, 28):
        big = bi == 16
        boom(t0, 1.0 if big else 0.85)
        note('orchestra_kit', 57, t0, 3.5, 0.75, pan=-0.35, busn='perc', release=1.5)
        note('orchestra_kit', 59, t0 + 0.01, 3.5, 0.6, pan=0.35, busn='perc', release=1.5)
        for m in (26, 38):
            note('brass_section', m, t0, 1.2 if big else 2.4, 0.9, busn='brass', release=1.0, sus=True)
        note('taiko_drum', 33, t0, 1.2, 1.0, busn='drums', release=0.8)
        note('timpani', 38, t0, 2.0, 1.0, busn='drums', release=1.0)
        note('acoustic_grand_piano', 26, t0, 2.5, 0.7, busn='low', release=2.0)
        note('acoustic_grand_piano', 38, t0, 2.5, 0.5, busn='low', release=2.0)
    # --- Glitzer an Abschnittsanfaengen
    if k == 0 and sec in ('II', 'III', 'V'):
        for e in range(6):
            note('fx_3_crystal', voic[e % 4] + 24, t0 + e * 0.11, 1.4, 0.07, pan=random.uniform(-.6, .6), busn='fx', release=1.5)

# ------------------------------------------------------------ Mischung
gains = {'strings': 0.85, 'ost': 0.9, 'low': 0.9, 'brass': 0.85, 'horn': 0.95, 'mel': 0.85, 'choir': 0.75,
         'drums': 1.0, 'perc': 0.55, 'boom': 1.0, 'piano': 0.8, 'harp': 0.7, 'fx': 0.7}
sends = {'strings': 0.5, 'ost': 0.28, 'low': 0.15, 'brass': 0.4, 'horn': 0.45, 'mel': 0.4, 'choir': 0.6,
         'drums': 0.35, 'perc': 0.4, 'boom': 0.12, 'piano': 0.45, 'harp': 0.5, 'fx': 0.7}
lp = {'low': 1400, 'drums': 6000, 'boom': 400, 'brass': 7000, 'choir': 7000}
dry = np.zeros((LEN, 2), np.float32); wet = np.zeros((LEN, 2), np.float32)
for name, b in BUS.items():
    x = lowpass_fft(b, lp[name]) if name in lp else b
    dry += x * gains.get(name, 0.8)
    wet += x * gains.get(name, 0.8) * sends.get(name, 0.3)

# Hall: grosser Saal, 3.4 s
n = int(3.4 * SR); t = np.arange(n) / SR
ir = np.zeros((n, 2), np.float32)
for ch in range(2):
    ir[:, ch] = np.random.randn(n).astype(np.float32) * np.exp(-t * 2.3) * (t > 0.03)
ir = lowpass_fft(ir, 4800)
ir /= np.sqrt((ir ** 2).sum(axis=0))[None, :]
def conv(x, h):
    L = 1 << int(np.ceil(np.log2(x.shape[0] + h.shape[0])))
    y = np.zeros((x.shape[0], 2), np.float32)
    for ch in range(2):
        y[:, ch] = np.fft.irfft(np.fft.rfft(x[:, ch], L) * np.fft.rfft(h[:, ch], L), L)[:x.shape[0]]
    return y
mix = dry + conv(wet, ir) * 0.6
# Die Schleife: was nach LOOP nachklingt, laeuft beim Neustart ueber die zweite
# Kopie (musicArm). Der Anfang bleibt deshalb trocken.
mix = mix / np.abs(mix).max() * 0.98
rms = np.sqrt((mix ** 2).mean())
target = 10 ** (-16 / 20)
mix = np.tanh(mix * (target / rms) * 1.25) * 0.94
print('peak', float(np.abs(mix).max()), 'rms dB', float(20 * np.log10(np.sqrt((mix ** 2).mean()))), 'loop', LOOP)
raw = OUT + 'ouverture.f32'
mix.astype(np.float32).tofile(raw)
subprocess.run([FF, '-y', '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', raw,
                '-af', 'afade=t=in:d=0.02', '-c:a', 'libmp3lame', '-b:a', '128k', OUT + 'ouverture.mp3'], check=True)
json.dump({'loop': LOOP, 'bpm': BPM, 'bars': TOTAL_BARS}, open(OUT + 'ouverture.json', 'w'))
print('ok', os.path.getsize(OUT + 'ouverture.mp3'))
