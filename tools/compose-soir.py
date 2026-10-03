# Lumière - "Soir à Paris": Kino + Jazz, gerendert aus FluidR3-Samples (MIT).
# Quelle der Samples: npm-Paket soundfont-for-samplers (FluidR3_GM, MIT,
# (c) Frank Wen). Holen:  npm pack soundfont-for-samplers && tar xzf soundfont-for-samplers-*.tgz
# Pfade per Umgebung:  SF=<.../package/FluidR3_GM>  OUT=<Zielordner>/
import numpy as np, subprocess, os, sys, random, json
import imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()
SF = os.environ.get('SF', 'package/FluidR3_GM')
OUT = os.environ.get('OUT', './')
SR = 44100
random.seed(7); np.random.seed(7)
NAMES = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']
_cache = {}
def sample(inst, midi):
    key = (inst, midi)
    if key in _cache: return _cache[key]
    name = NAMES[midi % 12] + str(midi // 12 - 1)
    path = f'{SF}/{inst}-mp3/{name}.mp3'
    raw = subprocess.run([FF, '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True).stdout
    a = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()
    # Stille am Anfang abschneiden (MP3-Vorlauf)
    idx = np.argmax(np.abs(a).max(axis=1) > 0.002)
    a = a[max(0, idx - 20):]
    _cache[key] = a
    return a

BPM = 72.0; BEAT = 60.0 / BPM; BAR = 4 * BEAT
BUS = {}
def bus(name, length):
    if name not in BUS: BUS[name] = np.zeros((length, 2), np.float32)
    return BUS[name]
TOTAL_BARS = 36
LOOP = TOTAL_BARS * BAR
LEN = int((LOOP + 7.0) * SR)

def sustain(a, dur):
    """Verlaengert ein Streicher/Flaechen-Sample durch Schleifen mit Ueberblendung."""
    need = int(dur * SR)
    if len(a) >= need: return a[:need].copy()
    ls, le = int(0.7 * SR), int(2.5 * SR)
    le = min(le, len(a) - int(0.1 * SR))
    seg = a[ls:le]
    xf = int(0.35 * SR)
    out = a[:le].copy()
    while len(out) < need:
        fade = np.linspace(0, 1, xf, dtype=np.float32)[:, None]
        tail = out[-xf:] * (1 - fade) + seg[:xf] * fade
        out = np.concatenate([out[:-xf], tail, seg[xf:]])
    return out[:need]

def onepole(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x); s = np.zeros(x.shape[1], np.float32)
    # schnell genug fuer Bus-Laenge? -> blockweise per numpy nicht trivial; nutze FFT-Tiefpass
    return y

def lowpass_fft(x, fc):
    X = np.fft.rfft(x, axis=0)
    f = np.fft.rfftfreq(x.shape[0], 1 / SR)
    H = 1 / np.sqrt(1 + (f / fc) ** 4)          # 2. Ordnung, weich
    return np.fft.irfft(X * H[:, None], n=x.shape[0], axis=0).astype(np.float32)

def note(inst, midi, t, dur, vel=0.8, pan=0.0, busn=None, attack=0.0, release=0.35, sus=False):
    a = sample(inst, midi)
    if sus: a = sustain(a, dur + release)
    else:
        n = min(len(a), int((dur + release) * SR))
        a = a[:n].copy()
    n = len(a)
    env = np.ones(n, np.float32)
    if attack > 0:
        k = min(n, int(attack * SR)); env[:k] = np.linspace(0, 1, k) ** 1.5
    r0 = int(dur * SR)
    if r0 < n:
        k = n - r0; env[r0:] *= np.linspace(1, 0, k) ** 2
    a = a * env[:, None] * vel
    gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    a[:, 0] *= gl * 1.414; a[:, 1] *= gr * 1.414
    t = t + random.gauss(0, 0.006)
    i = int(max(0, t) * SR)
    b = bus(busn or inst, LEN)
    j = min(LEN, i + n)
    b[i:j] += a[:j - i]

# ------------------------------------------------------------ Harmonie
C = {
 'Dmaj9':  (38, [54, 57, 61, 64]), 'Bm9':   (35, [57, 61, 62, 66]), 'Gmaj9': (43, [54, 57, 59, 62]),
 'A13sus': (45, [55, 59, 62, 66]), 'F#m7':  (42, [52, 57, 61, 64]), 'Em9':   (40, [55, 59, 62, 66]),
 'A13':    (45, [55, 61, 66, 71]), 'B7b9':  (47, [57, 60, 63, 67]), 'Dmaj7': (38, [54, 57, 61, 62]),
 'Gmaj7':  (43, [54, 59, 62, 66]), 'C#m7b5':(49, [55, 59, 64, 67]), 'F#7':   (42, [52, 58, 61, 64]),
 'A/G':    (43, [57, 61, 64, 69]), 'F#7sus':(42, [52, 59, 61, 64]),
}
INTRO = ['Dmaj9','Bm9','Gmaj9','A13sus','F#m7','Bm9','Em9','A13sus']
A = ['Dmaj7','Bm9','Em9','A13','F#m7','B7b9','Em9','A13','Dmaj7','Gmaj7','C#m7b5','F#7','Bm9','Em9','A13sus','A13']
B = ['Gmaj9','A/G','F#m7','Bm9','Em9','F#7','Bm9','A13sus']
OUTRO = ['Dmaj9','Bm9','Gmaj9','A13sus']
SONG = [('I', c) for c in INTRO] + [('A', c) for c in A] + [('B', c) for c in B] + [('O', c) for c in OUTRO]
assert len(SONG) == TOTAL_BARS

MEL_A = [
 [(0,76,1.5),(1.5,74,.5),(2,73,1),(3,69,1)], [(0,71,2.5),(3,73,.5),(3.5,74,.5)],
 [(0,78,1.5),(1.5,76,.5),(2,74,1),(3,71,1)], [(0,73,3),(3,69,1)],
 [(0,69,1),(1,73,1),(2,76,1.5),(3.5,78,.5)], [(0,75,2),(2,72,1),(3,71,1)],
 [(0,71,1.5),(1.5,74,.5),(2,78,1),(3,76,1)], [(0,76,2),(2,73,2)],
 [(0,81,1.5),(1.5,78,.5),(2,76,1),(3,74,1)], [(0,74,1),(1,71,1),(2,78,2)],
 [(0,76,1.5),(1.5,74,.5),(2,71,2)], [(0,73,1),(1,70,1),(2,73,1),(3,76,1)],
 [(0,78,2.5),(2.5,76,.5),(3,74,1)], [(0,71,1),(1,74,1),(2,78,1.5),(3.5,76,.5)],
 [(0,74,2),(2,71,1),(3,69,1)], [(0,73,3)],
]
MEL_B = [[(0,62,2),(2,66,2)], [(0,69,4)], [(0,73,2),(2,69,2)], [(0,66,4)],
         [(0,67,2),(2,71,2)], [(0,70,2),(2,73,2)], [(0,74,4)], [(0,73,2),(2,69,2)]]
MEL_I = {4: [(0,73,2),(2,69,2)], 5: [(0,74,3)], 6: [(0,71,2),(2,74,2)], 7: [(0,76,4)]}
MEL_O = {0: [(0,76,2),(2,74,2)], 1: [(0,73,4)], 2: [(0,71,4)]}

def swing(b):   # Achtel im Swing (2:1) - nur fuer Teil A
    whole = int(b); frac = b - whole
    return whole + (2/3 if abs(frac - 0.5) < 1e-6 else frac)

sec_bar = {'I': 0, 'A': 0, 'B': 0, 'O': 0}
for bi, (sec, cname) in enumerate(SONG):
    t0 = bi * BAR
    bass, voic = C[cname]
    k = sec_bar[sec]; sec_bar[sec] += 1
    # --- Streicherteppich (immer, in A leise)
    sv = {'I': 0.30, 'A': 0.16, 'B': 0.42, 'O': 0.26}[sec]
    for m in voic:
        note('string_ensemble_1', m + 12, t0, BAR * 1.02, sv * (0.9 + 0.2 * random.random()), pan=random.uniform(-.5, .5), busn='strings', attack=0.9 if sec != 'B' else 0.5, release=1.4, sus=True)
    if sec in 'IO':
        note('pad_2_warm', voic[0], t0, BAR, 0.18, pan=-.2, busn='pad', attack=1.2, release=1.6, sus=True)
        note('pad_2_warm', voic[2], t0, BAR, 0.14, pan=.3, busn='pad', attack=1.2, release=1.6, sus=True)
    # --- Bass
    if sec == 'A':
        if k < 4:    # erst im Zwei-Takt
            note('acoustic_bass', bass, t0, BEAT * 1.9, 0.9, pan=0.05, busn='bass', release=0.2)
            note('acoustic_bass', bass + 7 if bass + 7 < 50 else bass - 5, t0 + 2 * BEAT, BEAT * 1.9, 0.8, pan=0.05, busn='bass', release=0.2)
        else:        # dann gehend
            nxt = C[SONG[bi + 1][1]][0] if bi + 1 < len(SONG) else 38
            walk = [bass, bass + [3, 4][k % 2], bass + 7, nxt + (1 if nxt < bass + 7 else -1)]
            for q, m in enumerate(walk):
                while m > 52: m -= 12
                while m < 31: m += 12
                note('acoustic_bass', m, t0 + q * BEAT, BEAT * 0.95, 0.85 if q == 0 else 0.7, pan=0.05, busn='bass', release=0.15)
    elif sec == 'B':
        note('contrabass', bass, t0, BAR, 0.55, busn='bass', attack=0.3, release=1.0, sus=True)
        note('cello', bass + 12, t0, BAR, 0.25, pan=-0.3, busn='strings', attack=0.4, release=1.0, sus=True)
    else:
        note('contrabass', bass, t0, BAR, 0.38, busn='bass', attack=0.6, release=1.2, sus=True)
    # --- Harfe
    if sec in 'IO' and not (sec == 'I' and k < 2):
        tones = sorted(set([voic[0] + 12, voic[1] + 12, voic[2] + 12, voic[3] + 12, voic[0] + 24, voic[1] + 24]))
        pat = tones + tones[-2:0:-1]
        for e in range(8):
            note('orchestral_harp', pat[e % len(pat)], t0 + e * BEAT / 2, BEAT, 0.28 + 0.08 * (e == 0), pan=0.35, busn='harp', release=1.2)
    if sec == 'B' and k in (0, 4):
        gl = [m + o for o in (12, 24, 36) for m in voic]
        gl = sorted(set(x for x in gl if x < 100))
        for e, m in enumerate(gl):
            note('orchestral_harp', m, t0 - 0.6 + e * 0.045, 1.2, 0.22, pan=0.4, busn='harp', release=1.5)
    if sec == 'B':
        arp = [voic[0] + 12, voic[1] + 12, voic[2] + 12, voic[3] + 12]
        for e in range(8):
            note('acoustic_grand_piano', arp[[0, 1, 2, 3, 2, 1, 2, 3][e]], t0 + e * BEAT / 2, BEAT * 0.9, 0.22, pan=-0.15, busn='piano', release=0.6)
    # --- Klavier-Begleitung im Teil A (Charleston: 1 und 2-und, leicht)
    if sec == 'A':
        for b, v in ((0, 0.26), (1.5, 0.3)) if k % 2 == 0 else ((0.5, 0.24), (2.5, 0.3)):
            tt = t0 + swing(b) * BEAT
            for i, m in enumerate(voic):
                note('acoustic_grand_piano', m, tt + i * 0.008, BEAT * 0.9, v * (0.85 + 0.3 * random.random()), pan=-0.2, busn='piano', release=0.4)
    # --- Melodie
    mel, inst, vol, pan, sus = None, 'acoustic_grand_piano', 0.62, -0.05, False
    if sec == 'A': mel = MEL_A[k]
    elif sec == 'B': mel, inst, vol, pan, sus = MEL_B[k], 'cello', 0.62, -0.1, True
    elif sec == 'I': mel, vol = MEL_I.get(k), 0.5
    elif sec == 'O': mel, vol = MEL_O.get(k), 0.45
    if mel:
        for (b, m, d) in mel:
            bb = swing(b) if sec == 'A' else b
            if inst == 'cello':
                note('cello', m, t0 + bb * BEAT, d * BEAT * 0.98, vol, pan=pan, busn='cello', attack=0.25, release=0.8, sus=True)
                note('string_ensemble_1', m + 12, t0 + bb * BEAT, d * BEAT, 0.16, pan=0.3, busn='strings', attack=0.5, release=1.0, sus=True)
            else:
                note(inst, m, t0 + bb * BEAT, d * BEAT, vol * (0.9 + 0.2 * random.random()), pan=pan, busn='mel', release=0.8)
                if sec == 'A' and d >= 2:  # Oktave darunter als Stuetze
                    note(inst, m - 12, t0 + bb * BEAT + 0.01, d * BEAT, vol * 0.35, pan=pan, busn='mel', release=0.8)
    # --- Schlagzeug (Besen-Gefuehl: Ride, Pedal-HiHat, weiche Kick)
    if sec == 'A':
        for b in (0, 1, 1.5, 2, 3, 3.5):
            note('standard', 51, t0 + swing(b) * BEAT, 1.0, 0.16 if b in (1, 3) else 0.11, pan=0.35, busn='drums', release=0.8)
        for b in (1, 3):
            note('standard', 44, t0 + b * BEAT, 0.3, 0.2, pan=-0.3, busn='drums', release=0.1)
        if k % 4 == 0: note('standard', 36, t0, 0.3, 0.28, busn='drums', release=0.1)
        if k % 2 == 1: note('standard', 38, t0 + swing(3.5) * BEAT, 0.3, 0.07, pan=0.1, busn='drums', release=0.1)
    if sec == 'B':
        for b in (0, 1, 2, 3):
            note('standard', 51, t0 + b * BEAT, 1.0, 0.09, pan=0.35, busn='drums', release=0.8)
        if k in (0, 4): note('standard', 49, t0, 3.0, 0.1, pan=-0.4, busn='drums', release=1.0)
    # --- Glitzer (Kristall) an Abschnittsanfaengen
    if k == 0 or (sec == 'I' and k == 4):
        for e in range(5):
            note('fx_3_crystal', voic[e % 4] + 24, t0 + e * 0.13, 1.4, 0.07, pan=random.uniform(-.6, .6), busn='fx', release=1.5)

# ------------------------------------------------------------ Mischung
gains = {'strings': 0.9, 'pad': 0.6, 'bass': 0.95, 'harp': 0.8, 'piano': 0.7, 'mel': 0.95, 'cello': 0.9, 'drums': 0.75, 'fx': 0.7}
sends = {'strings': 0.55, 'pad': 0.6, 'bass': 0.12, 'harp': 0.5, 'piano': 0.35, 'mel': 0.4, 'cello': 0.45, 'drums': 0.25, 'fx': 0.7}
lp = {'bass': 1600, 'drums': 7000, 'piano': 7500, 'pad': 3500, 'strings': 9000}
dry = np.zeros((LEN, 2), np.float32); wet = np.zeros((LEN, 2), np.float32)
for name, b in BUS.items():
    x = b
    if name in lp: x = lowpass_fft(x, lp[name])
    dry += x * gains.get(name, 0.8)
    wet += x * gains.get(name, 0.8) * sends.get(name, 0.3)

# Hall: stereo, 2.8 s, mit Vorverzoegerung und daempfender Hoehe
n = int(2.8 * SR)
t = np.arange(n) / SR
ir = np.zeros((n, 2), np.float32)
for ch in range(2):
    noise = np.random.randn(n).astype(np.float32)
    ir[:, ch] = noise * np.exp(-t * 3.1) * (t > 0.022)
ir = lowpass_fft(ir, 5200)
ir /= np.sqrt((ir ** 2).sum(axis=0))[None, :] * 1.0
def conv(x, h):
    N = x.shape[0] + h.shape[0]
    L = 1 << int(np.ceil(np.log2(N)))
    y = np.zeros((x.shape[0], 2), np.float32)
    for ch in range(2):
        Y = np.fft.irfft(np.fft.rfft(x[:, ch], L) * np.fft.rfft(h[:, ch], L), L)[:x.shape[0]]
        y[:, ch] = Y
    return y
rev = conv(wet, ir) * 0.55
mix = dry + rev
# sanfte Kompression + weiche Begrenzung
peak = np.abs(mix).max()
mix = mix / peak * 0.98
rms = np.sqrt((mix ** 2).mean())
target = 10 ** (-17 / 20)
mix = np.tanh(mix * (target / rms) * 1.0) * 0.97
print('peak', float(np.abs(mix).max()), 'rms dB', float(20 * np.log10(np.sqrt((mix ** 2).mean()))), 'loop', LOOP)
wav = OUT + 'soir.f32'
mix.astype(np.float32).tofile(wav)
subprocess.run([FF, '-y', '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', wav,
                '-af', 'afade=t=in:d=0.02', '-c:a', 'libmp3lame', '-b:a', '128k', OUT + 'soir.mp3'], check=True)
json.dump({'loop': LOOP, 'bpm': BPM, 'bars': TOTAL_BARS}, open(OUT + 'soir.json', 'w'))
print('ok', os.path.getsize(OUT + 'soir.mp3'))
