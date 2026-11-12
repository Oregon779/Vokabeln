# Build 39: setzt wartung.html zusammen - das Glas-L kommt aus start.html (Abschnitt 'Glas-L (WebGL)' bis vor 'Ladebildschirm', makeGlass usw.).
# Einmalig benutzt; danach wird wartung.html direkt bearbeitet.
import sys
start, shell, out = sys.argv[1:4]
L = open(start, encoding='utf-8').read().split('\n')
a = next(i for i, l in enumerate(L) if '// ================= Glas-L (WebGL)' in l)
b = next(i for i, l in enumerate(L) if '// ================= Ladebildschirm: Glas-L' in l)
glass = '\n'.join(L[a:b]).rstrip()
if 'function makeGlass' not in glass or 'var L_OUTLINE' not in glass: raise SystemExit('Glas-Code nicht gefunden')
s = open(shell, encoding='utf-8').read().replace('/*@GLASS@*/', '  // ---- aus start.html uebernommen (Glas-L) ----\n' + glass)
open(out, 'w', encoding='utf-8').write(s)
print('wartung.html: %d KB' % (len(s) // 1024))
