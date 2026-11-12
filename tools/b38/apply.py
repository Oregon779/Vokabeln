# Build 38 in index.html einbauen - immer vom letzten Commit aus (wiederholbar)
import re, subprocess, sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = '/home/user/Vokabeln'
s = subprocess.run(['git', '-C', REPO, 'show', 'HEAD:index.html'], capture_output=True, text=True, check=True).stdout
def R(a, b, n=1):
    global s
    c = s.count(a)
    assert c == n, (c, a[:120]); s = s.replace(a, b)

# ---------- Version ----------
R('const APP_VERSION = 37;', 'const APP_VERSION = 38;')

# ---------- Schriften: Cormorant Garamond + Geist (Google Fonts laedt Dateien nur, wenn sie benutzt werden) ----------
R('family=Newsreader:ital,wght@0,500;0,600;1,500;1,600&display=swap', 'family=Newsreader:ital,wght@0,500;0,600;1,500;1,600&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Geist:wght@300..700&family=Geist+Mono:wght@400;500&display=swap')

# ---------- CSS: Farbschicht (erzeugt) + Gestaltung (von Hand), beide nur unter html.build-38-live ----------
sys.path.insert(0, HERE)
open(os.path.join(HERE, '_head.html'), 'w').write(s)
subprocess.run([sys.executable, os.path.join(HERE, 'recolor.py'), os.path.join(HERE, '_head.html'), os.path.join(HERE, 'recolor.css')], check=True)
recolor = open(os.path.join(HERE, 'recolor.css')).read()
# Handgeschriebene Regeln mit Praefix versehen (gleiche Logik wie in recolor.py)
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
def scope(t):
    out = []; i = 0
    while i < len(t):
        j = t.find('{', i)
        if j < 0: break
        pre = t[i:j].strip(); k = block_end(t, j); body = t[j + 1:k]; i = k + 1
        if pre.startswith('@media') or pre.startswith('@supports'): out.append(pre + '{' + scope(body) + '}'); continue
        if pre.startswith('@'): out.append(pre + '{' + body + '}'); continue
        out.append(', '.join(prefix(x) for x in split_top(pre, ',')) + '{' + body.strip() + '}')
    return '\n'.join(out)
hand = re.sub(r'/\*.*?\*/', '', open(os.path.join(HERE, 'hand.css')).read(), flags=re.S)
css38 = ('\n  /* ===== Build 38 "Maison Noir" - alles nur unter html.build-38-live =====\n'
         '     Teil 1 (erzeugt von tools/b38/recolor.py): jede Regel mit Gold/Nachtblau als Kopie in Champagner/warmem Schwarz.\n'
         '     Teil 2 (tools/b38/hand.css): Schriften, Knoepfe, Karten, Felder, Navigation, Heute, Seiten-Layouts. */\n'
         '  .qn-l{display:none;}\n' + recolor + scope(hand) + '\n')
idx = s.index('</style>')
s = s[:idx] + css38 + s[idx:]

# ---------- Kopfleiste: fuenf Punkte (Heute, Lernsets, Spielhalle, Klassen, Mehr) ----------
R('''    <button type="button" class="header-nav-item" data-goto="hub">Startseite</button>
    <button type="button" class="header-nav-item" data-goto="home">Lernsets</button>
    <button type="button" class="header-nav-item" data-goto="classes" data-build="35">Klassen</button>
    <button type="button" class="header-nav-item" data-goto="listen">Aussprache</button>
    <button type="button" class="header-nav-item" data-goto="grammar">Grammatik</button>
    <button type="button" class="header-nav-item" data-goto="rewards">Belohnungen</button>
    <button type="button" class="header-nav-item" data-goto="calendar">Kalender</button>
    <button type="button" class="header-nav-item" data-goto="appDownload">App</button>
    <button type="button" class="header-nav-item" data-goto="about">Über uns</button>''', '''    <button type="button" class="header-nav-item" data-goto="hub" data-build="38">Heute</button>
    <button type="button" class="header-nav-item" data-goto="hub" data-build-old="38">Startseite</button>
    <button type="button" class="header-nav-item" data-goto="home">Lernsets</button>
    <button type="button" class="header-nav-item" data-goto="rewards" data-build="38">Spielhalle</button>
    <button type="button" class="header-nav-item" data-goto="classes" data-build="35">Klassen</button>
    <button type="button" class="header-nav-item" data-goto="listen" data-build-old="38">Aussprache</button>
    <button type="button" class="header-nav-item" data-goto="grammar" data-build-old="38">Grammatik</button>
    <button type="button" class="header-nav-item" data-goto="rewards" data-build-old="38">Belohnungen</button>
    <button type="button" class="header-nav-item" data-goto="calendar" data-build-old="38">Kalender</button>
    <button type="button" class="header-nav-item" data-goto="appDownload" data-build-old="38">App</button>
    <button type="button" class="header-nav-item" data-goto="about" data-build-old="38">Über uns</button>
    <button type="button" class="header-nav-item" data-more38 data-build="38" aria-haspopup="true">Mehr</button>''')

# ---------- Tab-Leiste (Handy/iPad): Heute, Lernsets, Spielhalle, Klassen, Mehr ----------
qn_a = s.index('<nav class="quick-nav" id="quickNav"'); qn_b = s.index('</nav>', qn_a)
qn = s[qn_a:qn_b]
def item(goto, label, svg, extra=''):
    return f'''  <button type="button" class="quick-nav-item" data-goto="{goto}" aria-label="{label}" title="{label}"{extra}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">{svg}</svg><span class="qn-l">{label}</span>
  </button>
'''
qn = qn.replace('''  <button type="button" class="quick-nav-item" data-goto="home"''', item('hub', 'Heute', '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>', ' data-build="38"') + '''  <button type="button" class="quick-nav-item" data-goto="home"''', 1)
qn = qn.replace('''  <button type="button" class="quick-nav-item" data-goto="calendar"''', '''  <button type="button" class="quick-nav-item" data-goto="calendar" data-build-old="38"''', 1)
qn = qn.replace('''  <button type="button" class="quick-nav-item" data-goto="grammar"''', item('classes', 'Klassen', '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c.7-3 2.9-4.6 5.5-4.6s4.8 1.6 5.5 4.6"/><circle cx="16.5" cy="9.5" r="2.4"/><path d="M15.6 14.6c2.3.1 4.1 1.6 4.8 4.4"/>', ' data-build="38"') + '''  <button type="button" class="quick-nav-item" data-goto="grammar" data-build-old="38"''', 1)
# Beschriftungen an die bestehenden Knoepfe (nur unter 38 sichtbar)
for goto, label in (('home', 'Lernsets'), ('rewards', 'Spielhalle')):
    a = qn.index(f'data-goto="{goto}" aria-label'); b = qn.index('</svg>', a) + 6
    qn = qn[:b] + f'<span class="qn-l">{label}</span>' + qn[b:]
a = qn.index('id="quickNavMenu"'); b = qn.index('</svg>', a) + 6
qn = qn[:b] + '<span class="qn-l">Mehr</span>' + qn[b:]
s = s[:qn_a] + qn + s[qn_b:]

# ---------- Mehr-Menue: "Heute" statt "Startseite", fuer Admins Vorschau + Admin-Panel ----------
R('''      <li><button class="nav-overlay-item" data-goto="hub"><span class="idx">01</span><span class="label">Startseite</span><span class="hint">Willkommen</span></button></li>''',
  '''      <li data-build-old="38"><button class="nav-overlay-item" data-goto="hub"><span class="idx">01</span><span class="label">Startseite</span><span class="hint">Willkommen</span></button></li>
      <li data-build="38"><button class="nav-overlay-item" data-goto="hub"><span class="idx">01</span><span class="label">Heute</span><span class="hint">Fällige Wörter, Ziel und Serie</span></button></li>''')
R('''      <li data-build="35"><button class="nav-overlay-item" data-goto="classes"><span class="idx">11</span><span class="label">Klassen</span><span class="hint">Gemeinsam im Unterricht lernen</span></button></li>
    </ul>''', '''      <li data-build="35"><button class="nav-overlay-item" data-goto="classes"><span class="idx">11</span><span class="label">Klassen</span><span class="hint">Gemeinsam im Unterricht lernen</span></button></li>
      <li data-build="38" class="admin-only38"><button class="nav-overlay-item" data-goto-special38="guestStart"><span class="idx">12</span><span class="label">Gäste-Startseite</span><span class="hint">Vorschau, wie Gäste die Startseite sehen</span></button></li>
      <li data-build="38" class="admin-only38"><button class="nav-overlay-item" data-goto-special38="admin"><span class="idx">13</span><span class="label">Admin-Panel</span><span class="hint">Betreiber-Ansicht</span></button></li>
    </ul>''')


# ---------- Spielhalle: eigener Kopf unter 38 (die Seite heisst in der Navigation jetzt so) ----------
R("""    <div class="page-eyebrow-row"><span class="eyebrow-dot" aria-hidden="true"></span><p class="page-eyebrow">Belohnungen · 05</p></div>
    <h2 class="page-title" style="margin-bottom:.6rem;">Deine <em class="gold-shimmer" style="font-style:italic;">Lern-Serie</em></h2>
    <p class="page-sub">Jede abgeschlossene Übungsrunde zählt: Sie baut deine Serie auf und bringt Coins, die du unten in den Spielen einsetzen kannst.</p>""",
  """    <div class="page-eyebrow-row" data-build-old="38"><span class="eyebrow-dot" aria-hidden="true"></span><p class="page-eyebrow">Belohnungen · 05</p></div>
    <h2 class="page-title" style="margin-bottom:.6rem;" data-build-old="38">Deine <em class="gold-shimmer" style="font-style:italic;">Lern-Serie</em></h2>
    <p class="page-sub" data-build-old="38">Jede abgeschlossene Übungsrunde zählt: Sie baut deine Serie auf und bringt Coins, die du unten in den Spielen einsetzen kannst.</p>
    <div class="page-eyebrow-row" data-build="38"><span class="eyebrow-dot" aria-hidden="true"></span><p class="page-eyebrow">Spielhalle</p></div>
    <h2 class="page-title" data-build="38">Spielen &amp; <em>sammeln</em></h2>
    <p class="page-sub" data-build="38">Spiele mit deinen Vokabeln – oder einfach so. Jede Übungsrunde baut deine Serie auf und bringt Coins.</p>""")
R("""      <li><button class="nav-overlay-item" data-goto="rewards"><span class="idx">05</span><span class="label">Belohnungen</span>""",
  """      <li data-build="38"><button class="nav-overlay-item" data-goto="rewards"><span class="idx">05</span><span class="label">Spielhalle</span><span class="hint">Spiele, Serie &amp; Coins</span><span class="lock-badge" hidden>🔒 Konto</span></button></li>
      <li data-build-old="38"><button class="nav-overlay-item" data-goto="rewards"><span class="idx">05</span><span class="label">Belohnungen</span>""")


# ---------- Footer: Heute/Spielhalle statt Startseite/Belohnungen ----------
R("""        <button type="button" data-goto="hub">Startseite</button>
        <button type="button" data-goto="home">Lernsets</button>
        <button type="button" data-goto="classes" data-build="35">Klassen</button>
        <button type="button" data-goto="listen">Aussprache</button>
        <button type="button" data-goto="grammar">Grammatik</button>
        <button type="button" data-goto="rewards">Belohnungen</button>""", """        <button type="button" data-goto="hub" data-build-old="38">Startseite</button>
        <button type="button" data-goto="hub" data-build="38">Heute</button>
        <button type="button" data-goto="home">Lernsets</button>
        <button type="button" data-goto="rewards" data-build="38">Spielhalle</button>
        <button type="button" data-goto="classes" data-build="35">Klassen</button>
        <button type="button" data-goto="listen">Aussprache</button>
        <button type="button" data-goto="grammar">Grammatik</button>
        <button type="button" data-goto="rewards" data-build-old="38">Belohnungen</button>""")

# ---------- Heute-Seite + Rahmen fuer die Gaeste-Startseite ----------
R('  <section id="view-hub" class="view view-cine">', open(os.path.join(HERE, 'today.html')).read() + '''  <section id="view-hub" class="view view-cine">
    <!-- Build 38: Gaeste sehen hier die neue Startseite (start.html); die 3D-Reise darunter bleibt bis zur Freigabe -->
    <div class="hub38" data-build="38"><iframe id="hub38Frame" title="Lumière – Startseite"></iframe></div>''')

# ---------- JS ----------
R("// Musik (Build 27): Knopf im Startbild", open(os.path.join(HERE, 'b38.js')).read() + "\n// Musik (Build 27): Knopf im Startbild")
R('''function renderHub(){
  if(lessonOn35()){ renderHome(); return; }''', '''function renderHub(){
  if(lessonOn35()){ renderHome(); return; }
  // Build 38: Angemeldete landen auf "Heute", Gaeste auf der neuen Startseite
  if(isReleased(38)){ if(currentUser) renderToday38(); else showGuestStart38(false); return; }''')
R('''  function start(){
    if(running) return;
    running = true;''', '''  function start(){
    if(running) return;
    // Build 38: die 3D-Reise ist ersetzt - nichts starten, nichts laden
    try{ if(isReleased(38)) return; }catch(e){}
    running = true;''')
R('  window.cineFieldStart = start;\n})();', '  window.cineFieldStart = start;\n  window.cineFieldStop = stop;\n})();')
R("""    if(label) label.textContent = `Vorschau · Build ${APP_VERSION} (öffentlich: ${liveBuild})`;
  }
}""", """    if(label) label.textContent = `Vorschau · Build ${APP_VERSION} (öffentlich: ${liveBuild})`;
  }
  try{ if(typeof onGate38 === 'function') onGate38(); }catch(e){ console.warn(e); }
}""")
R("""  return !!store.settings.musicOn && currentViewIsHub() && document.visibilityState === 'visible';""",
  """  let b38 = false; try{ b38 = isReleased(38); }catch(e){}
  return !b38 && !!store.settings.musicOn && currentViewIsHub() && document.visibilityState === 'visible';""")
R("""function applySettingsToUI(){
  const g = store.settings.glowIntensity;
  document.documentElement.style.setProperty('--shadow-glow',""", """function applySettingsToUI(){
  const g = store.settings.glowIntensity;
  // Build 38: kein goldenes Leuchten - die Werte kommen dann aus dem Stylesheet
  let b38 = false; try{ b38 = isReleased(38); }catch(e){}
  if(b38){ document.documentElement.style.removeProperty('--shadow-glow'); document.documentElement.style.removeProperty('--shadow-glow-lg'); }
  else document.documentElement.style.setProperty('--shadow-glow',""")
R("""  document.documentElement.style.setProperty('--shadow-glow-lg',""", """  if(!b38) document.documentElement.style.setProperty('--shadow-glow-lg',""")
# 3D-Buendel erst laden, wenn die 3D-Reise wirklich startet (vorher kam es mit jedem Seitenaufruf)
R('<script src="./lumiere-gl.js?v=37" defer></script>\n', '')
R("""    if(!window.LumiereGL){
      if(!glTried){
        glTried = true;
        window.addEventListener('load', () => { glTried = false; ensureGl(then); }, { once:true });
      }
      return;
    }""", """    if(!window.LumiereGL){
      // Seit Build 38 kommt das Buendel erst hier (bei Bedarf); der Versionsanhang ?v= bleibt Pflicht
      if(!glTried){
        glTried = true;
        const sc = document.createElement('script');
        sc.src = './lumiere-gl.js?v=37'; sc.async = true;
        sc.onload = () => { glTried = false; ensureGl(then); };
        document.head.appendChild(sc);
      }
      return;
    }""")
# admin-only Eintraege
s = s.replace(css38, css38.replace('\n  .qn-l{display:none;}\n', '\n  .qn-l{display:none;}\n  html.build-38-live body:not(.is-admin38) .admin-only38{display:none !important;}\n'), 1)

open(os.path.join(REPO, 'index.html'), 'w').write(s)
print('index.html', len(s))
