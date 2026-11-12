# Erzeugt die Farbschicht fuer Build 38 ("Maison Noir"): jede CSS-Regel aus index.html, die Gold-
# oder Nachtblau-Toene enthaelt, bekommt eine Kopie mit Champagner/warmem Schwarz - nur unter
# html.build-38-live. So folgt die ganze App (auch Admin) dem neuen Look, ohne ihr Markup anzufassen.
import re, colorsys, sys
src = sys.argv[1]; out = sys.argv[2]
s = open(src).read()
m = re.search(r'<style[^>]*>(.*?)</style>', s, re.S)
css = re.sub(r'/\*.*?\*/', '', m.group(1), flags=re.S)

def hx(c):
    c = c.lstrip('#')
    if len(c) == 3: c = ''.join(ch * 2 for ch in c)
    return tuple(int(c[i:i+2], 16) for i in (0, 2, 4))
def remap(r, g, b):
    h, l, sat = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    hd = h * 360
    if sat >= .28 and 18 <= hd <= 58 and l > .06:          # Gold, Bernstein, Braun -> Champagner
        ns = min(.36, sat * .42) if l < .9 else min(.42, sat * .5)
        nh, nl = 38 / 360, l * (.96 if l > .5 else 1)
    elif 190 <= hd <= 265 and l < .3 and sat > .08:        # Nachtblau -> warmes Schwarz
        nh, ns, nl = 32 / 360, min(.22, sat * .6), l * .86
    elif 190 <= hd <= 265 and l < .55 and sat > .15:       # mittleres Blau/Schiefer -> warmes Grau
        nh, ns, nl = 35 / 360, min(.12, sat * .4), l
    else:
        return None
    rr, gg, bb = colorsys.hls_to_rgb(nh, nl, ns)
    return round(rr * 255), round(gg * 255), round(bb * 255)
def sub_color(mo):
    t = mo.group(0)
    if t.startswith('#'):
        if len(t) not in (4, 7): return t
        n = remap(*hx(t));  return t if n is None else '#%02x%02x%02x' % n
    inner = t[t.index('(') + 1:-1].replace('/', ',')
    parts = [p.strip() for p in inner.replace(' ', ',').split(',') if p.strip()]
    try: r, g, b = (float(parts[0]), float(parts[1]), float(parts[2]))
    except Exception: return t
    n = remap(r, g, b)
    if n is None: return t
    a = parts[3] if len(parts) > 3 else None
    return 'rgba(%d,%d,%d,%s)' % (n + (a,)) if a is not None else 'rgb(%d,%d,%d)' % n
COL = re.compile(r'#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]*\)')

def split_top(text, sep):
    out, depth, cur = [], 0, ''
    for ch in text:
        if ch in '([': depth += 1
        elif ch in ')]': depth -= 1
        if ch == sep and depth == 0: out.append(cur); cur = ''
        else: cur += ch
    out.append(cur); return out
def prefix(sel):
    sel = sel.strip()
    if not sel: return sel
    if sel.startswith(':root'): return 'html.build-38-live' + sel[5:]
    if re.match(r'html(?![\w-])', sel): return 'html.build-38-live' + sel[4:]
    return 'html.build-38-live ' + sel
def block_end(t, i):
    d = 0
    while i < len(t):
        if t[i] == '{': d += 1
        elif t[i] == '}':
            d -= 1
            if d == 0: return i
        i += 1
    return len(t) - 1
res = []; stats = [0, 0]
def walk(t, wrap):
    i = 0
    while i < len(t):
        j = t.find('{', i)
        if j < 0: break
        pre = t[i:j].strip(); k = block_end(t, j); body = t[j + 1:k]; i = k + 1
        if pre.startswith('@media') or pre.startswith('@supports'): walk(body, wrap + [pre]); continue
        if pre.startswith('@'): continue
        decls = []
        for d in split_top(body, ';'):
            if ':' not in d: continue
            nd = COL.sub(sub_color, d)
            if nd != d: decls.append(nd.strip())
        stats[0] += 1
        if not decls: continue
        # "background:" als Kurzform setzt background-clip zurueck - Verlaufsschrift wuerde zum Balken
        if any(re.match(r'\s*background\s*:', x) for x in decls):
            for d in split_top(body, ';'):
                if re.match(r'\s*(-webkit-)?background-clip\s*:', d) or re.match(r'\s*background-(size|position|repeat)\s*:', d): decls.append(d.strip())
        stats[1] += 1
        sel = ', '.join(prefix(x) for x in split_top(pre, ','))
        rule = sel + '{' + '; '.join(decls) + '}'
        for w in reversed(wrap): rule = w + '{' + rule + '}'
        res.append(rule)
walk(css, [])
open(out, 'w').write('\n'.join(res) + '\n')
print('Regeln', stats[0], 'umgefaerbt', stats[1], 'Bytes', sum(len(x) + 1 for x in res))
