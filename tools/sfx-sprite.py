# Lumière - Klang-Sprite aus FluidR3-Samples (MIT, (c) Frank Wen).
# Quelle der Samples: npm-Paket soundfont-for-samplers (FluidR3_GM, MIT,
# (c) Frank Wen). Holen:  npm pack soundfont-for-samplers && tar xzf soundfont-for-samplers-*.tgz
# Pfade per Umgebung:  SF=<.../package/FluidR3_GM>  OUT=<Zielordner>/
# Jeder Platz beginnt an einer vollen Zehntelsekunde nach 0,25 s Stille;
# die Seite sucht den genauen Einsatz beim Laden selbst (MP3-Vorlauf).
import numpy as np, subprocess, json, os
import imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()
SF = os.environ.get('SF', 'package/FluidR3_GM')
OUT = os.environ.get('OUT', './')
SR = 44100
NAMES = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']
def load(inst, midi):
    name = NAMES[midi % 12] + str(midi // 12 - 1)
    raw = subprocess.run([FF, '-v', 'error', '-i', f'{SF}/{inst}-mp3/{name}.mp3', '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True).stdout
    a = np.frombuffer(raw, dtype=np.float32).copy()
    i = int(np.argmax(np.abs(a) > 0.003))
    return a[max(0, i - 8):]
# name, Instrument, MIDI, Laenge in s
SLOTS = [
    ('harp',    'orchestral_harp',      62, 2.2),
    ('harpHi',  'orchestral_harp',      81, 1.8),
    ('crystal', 'fx_3_crystal',         86, 2.4),
    ('marimba', 'marimba',              74, 0.9),
    ('mariHi',  'marimba',              86, 0.6),
    ('piano',   'acoustic_grand_piano', 74, 2.2),
    ('pianoLo', 'acoustic_grand_piano', 50, 3.0),
    ('epiano',  'electric_piano_1',     69, 2.0),
    ('pizz',    'pizzicato_strings',    62, 0.8),
    ('choir',   'pad_4_choir',          62, 3.2),
    ('glass',   'pad_5_bowed',          69, 3.2),
    ('halo',    'pad_7_halo',           74, 2.8),
    ('horn',    'french_horn',          62, 1.8),
    ('timp',    'timpani',              38, 2.4),
]
buf = [np.zeros(int(0.25 * SR), np.float32)]
pos = 0.25
meta = {}
for name, inst, midi, dur in SLOTS:
    a = load(inst, midi)
    n = int(dur * SR)
    if len(a) < n: a = np.concatenate([a, np.zeros(n - len(a), np.float32)])
    a = a[:n]
    # Ende weich ausblenden (letzte 35 %), damit nichts abgeschnitten klingt
    f = int(n * 0.35)
    a[-f:] *= np.linspace(1, 0, f, dtype=np.float32) ** 1.6
    a = a / (np.abs(a).max() + 1e-9) * 0.89
    start = float(np.ceil(pos * 10 - 1e-6) / 10)
    pad = int(round((start - pos) * SR))
    if pad > 0: buf.append(np.zeros(pad, np.float32))
    buf.append(a)
    meta[name] = [start, dur, midi]
    pos = start + dur + 0.25
    buf.append(np.zeros(int(0.25 * SR), np.float32))
    pos = round(pos + 0.0, 4)
    # auf naechste Zehntel fuer den Beginn des naechsten Platzes
    nxt = np.ceil(pos * 10) / 10
    gap = int(round((nxt - pos) * SR))
    if gap > 0: buf.append(np.zeros(gap, np.float32))
    pos = nxt
out = np.concatenate(buf)
print('len', len(out) / SR)
out.astype(np.float32).tofile(OUT + 'sfx.f32')
subprocess.run([FF, '-y', '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', OUT + 'sfx.f32',
                '-c:a', 'libmp3lame', '-b:a', '80k', OUT + 'sfx.mp3'], check=True)
json.dump(meta, open(OUT + 'sfx.json', 'w'))
print(json.dumps(meta))
