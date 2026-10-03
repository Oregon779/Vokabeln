# Karten-Videos (Build 30): Rohaufnahme -> nahtlose Schleife (Ende blendet in
# den Anfang), leicht weichgezeichnet (liegt hinter Milchglas), H.264 fuer
# Safari, VP9 fuer Chromium ohne H.264, dazu ein WebP-Standbild als Poster.
import subprocess, imageio_ffmpeg, re, os
FF = imageio_ffmpeg.get_ffmpeg_exe()
SRC = (os.environ.get('WORK') or os.path.join(os.path.dirname(__file__), 'work')) + '/'
OUT = SRC + 'out/'
os.makedirs(OUT, exist_ok=True)
X = 0.8
for n in ['lernsets','aussprache','grammatik','belohnungen','kalender','app','ueberuns']:
    raw = SRC + n + '-raw.mp4'
    info = subprocess.run([FF, '-i', raw], capture_output=True, text=True).stderr
    h, m, s = re.search(r'Duration: (\d+):(\d+):([\d.]+)', info).groups()
    D = int(h)*3600 + int(m)*60 + float(s)
    D = min(D, 14.0)            # hoechstens 14 s
    fc = (f"[0:v]fps=25,trim=0:{D},setpts=PTS-STARTPTS,split[a][b];"
          f"[b]trim=0:{X},setpts=PTS-STARTPTS,fps=25[h];"
          f"[a]trim={X}:{D},setpts=PTS-STARTPTS,fps=25[m];"
          f"[m][h]xfade=transition=fade:duration={X}:offset={D - 2*X:.3f},gblur=sigma=1.8,eq=saturation=1.12,format=yuv420p[v]")
    base = OUT + 'card-' + n
    subprocess.run([FF, '-y', '-v', 'error', '-i', raw, '-filter_complex', fc, '-map', '[v]', '-an',
                    '-c:v', 'libx264', '-crf', '27', '-preset', 'slow', '-profile:v', 'high', '-movflags', '+faststart', base + '.mp4'], check=True)
    subprocess.run([FF, '-y', '-v', 'error', '-i', base + '.mp4', '-an', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '38',
                    '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', base + '.webm'], check=True)
    subprocess.run([FF, '-y', '-v', 'error', '-ss', '0.05', '-i', base + '.mp4', '-frames:v', '1', '-c:v', 'libwebp', '-quality', '72', base + '.webp'], check=True)
    print(n, round(D - X, 2), 's', {e: os.path.getsize(base + e) // 1024 for e in ('.mp4', '.webm', '.webp')})
