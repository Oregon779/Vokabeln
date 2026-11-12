# Build 39: setzt admin.html aus dem Admin-Teil von index.html (Stand Build 38) zusammen.
# Einmalig benutzt - danach wird admin.html direkt bearbeitet. Quelle: git show 72d9bd1:index.html
#   python3 tools/b39/mkadmin.py src38.html shell.html admin.html
# shell.html enthaelt die Platzhalter /*@CSS@*/, <!--@MARKUP@-->, <!--@DIALOGS@-->, /*@JS@*/.
import re, sys
src, shell, out = sys.argv[1:4]
L = open(src, encoding='utf-8').read().split('\n')
def lines(a, b):            # 1-basiert, einschliesslich
    return '\n'.join(L[a - 1:b])

# ---------- Markup ----------
admin = lines(7177, 7573)
# Lehrkraefte raus (Build 39), Kopf der alten Seite raus
admin = re.sub(r'\s*<button type="button" class="admin-nav-item" data-admin-tab="teachers".*?</button>', '', admin, flags=re.S)
admin = re.sub(r'\s*<div class="admin-tab-panel" data-admin-panel="teachers".*?\n            </div>\n(?=\s*<div class="admin-tab-panel" data-admin-panel="version")', '\n', admin, flags=re.S)
def must_sub(pat, rep, text, flags=0):
    new, n = re.subn(pat, rep, text, count=1, flags=flags)
    if n != 1: raise SystemExit('Muster nicht gefunden: ' + pat[:70])
    return new
IC = lambda d: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'
admin = admin.replace('<section id="view-admin" class="view" hidden>', '<section id="view-admin">', 1)
admin = must_sub(r'\s*<p class="page-eyebrow">Admin-Panel</p>\s*<h2 class="page-title"[^>]*>Betreiber-Ansicht</h2>', '', admin)
admin = admin.replace('<p class="page-sub" id="adminAccessNote">', '<p class="page-sub" id="adminAccessNote" hidden>', 1)
admin = admin.replace('<div id="adminContent" hidden>', '<div id="adminContent">', 1)
admin = admin.replace('<div class="admin-shell" id="adminShell">', '<div class="admin-shell" id="adminShell">\n        <div class="a39-scrim" id="a39Scrim" onclick="closeDrawer39()"></div>', 1)
# Seitenleiste unten: wer angemeldet ist, zur Website, Abmelden
admin = must_sub(r'(<div class="admin-sidebar-foot">)', r'''\1
            <div class="a39-me" id="a39Me"><span class="a39-me-pic"></span><span><b></b><small></small></span></div>
            <a class="admin-nav-item" href="./" target="_blank" rel="noopener">''' + IC('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>') + '''Zur Website</a>
            <button type="button" class="admin-nav-item" id="a39Logout">''' + IC('<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l-4-4 4-4M6 12h10"/>') + '''Abmelden</button>''', admin)
# Kopfzeile rechts: Live, Wartung-Schnellschalter, Aktualisieren
admin = must_sub(r'(<span class="pill is-ok"[^\n]*Live</span>)', r'''\1
            <div class="a39-top-r">
              <span class="a39-live" id="a39Live" title="Änderungen kommen live an"><i></i><span>Live</span></span>
              <button type="button" class="a39-mt" id="a39Mt" aria-pressed="false" onclick="setMaintenance39(!(siteSettings &amp;&amp; siteSettings.maintenance_mode))"><span class="sw" aria-hidden="true"></span><span class="t">Wartung aus</span></button>
              <button type="button" class="a39-icon-btn" title="Neu laden" aria-label="Daten neu laden" onclick="loadAdminData(); loadAdminAbos(); loadPicReviews(); loadOverview39();">''' + IC('<path d="M20 11a8 8 0 1 0-2.3 6"/><path d="M20 5v6h-6"/>') + '''</button>
            </div>''', admin)
# Uebersicht: Begruessung, Besuche, KI-Kontingent, Kennzahlen, Neueste Konten, Zu erledigen
OVERVIEW = '''<div class="admin-tab-panel" data-admin-panel="overview">
              <div class="a39-hello">
                <div><p class="a39-kick" id="a39Date"></p><h1 id="a39Greet">Bonsoir</h1><p class="a39-sub">So steht Lumière gerade da.</p></div>
                <div class="a39-hello-act"><button type="button" class="a39-btn ghost" data-go39="users">Nutzer</button><button type="button" class="a39-btn ghost" data-go39="maintenance">Wartung</button></div>
              </div>
              <div class="a39-grid">
                <section class="a39-card">
                  <div class="a39-card-h"><div><h2>Besuche</h2><small>Sitzungen je Tag · Punkt = neue Konten</small></div>
                    <div class="a39-seg" role="group" aria-label="Zeitraum"><button type="button" data-range39="7">7 Tage</button><button type="button" data-range39="14" class="on">14 Tage</button><button type="button" data-range39="30">30 Tage</button></div></div>
                  <div class="a39-bars" id="a39Bars"></div>
                  <div class="a39-legend"><span><i></i>Besuche <b id="a39BarsSum">–</b></span><span>Ø pro Tag <b id="a39BarsAvg">–</b></span><span>Konten aktiv <b id="a39BarsUsers">–</b></span><span><i class="dot"></i>Neu <b id="a39BarsReg">–</b></span></div>
                </section>
                <section class="a39-card">
                  <div class="a39-card-h"><div><h2>KI-Kontingent heute</h2><small>Website-weit, nach deutscher Zeit</small></div></div>
                  <div class="a39-donut">
                    <div class="a39-ring"><svg viewBox="0 0 140 140"><circle class="bg" cx="70" cy="70" r="60"/><circle class="fg" id="a39RingFg" cx="70" cy="70" r="60" stroke-dasharray="377" stroke-dashoffset="377"/></svg>
                      <div class="a39-ring-t"><b id="a39RingPct">–</b><span>genutzt</span></div></div>
                    <div class="a39-kv"><div>Anfragen heute <b id="a39CapUsed">–</b></div><div>Noch frei <b id="a39CapFree">–</b></div><div>Obergrenze <b id="a39CapTotal">–</b></div><div>Limit je Konto <b id="a39CapLimit">–</b></div></div>
                  </div>
                </section>
              </div>
              <div class="admin-stat-row">'''
admin = must_sub(r'<div class="admin-tab-panel" data-admin-panel="overview">\s*<div class="admin-stat-row">', OVERVIEW, admin)
KPIS = ''.join('''
                <div class="admin-stat a39-kpi"%s>
                  <div class="admin-stat-head"><span class="admin-stat-icon">%s</span><span class="admin-stat-label">%s</span></div>
                  <span class="admin-stat-value" id="%s">–</span>
                  <p class="admin-stat-note" id="%sN">%s</p>
                </div>''' % ((' data-go39="%s"' % go) if go else '', IC(ic), lab, i, i, note) for go, ic, lab, i, note in [
    ('users', '<path d="M12 5v14M5 12h14"/>', 'Neu (7 Tage)', 'a39KpiNew', 'Registrierungen der letzten Woche.'),
    ('abos', '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>', 'Offene Anfragen', 'a39KpiOpen', 'Tarif-Anfragen ohne Antwort.'),
    ('photos', '<circle cx="12" cy="9" r="3.5"/><path d="M5 20c1.2-3.6 3.8-5.4 7-5.4s5.8 1.8 7 5.4"/>', 'Fotos warten', 'a39KpiPhotos', 'Profilfotos zur Freigabe.'),
    ('abos', '<path d="M17 7.5A6 6 0 1 0 17 16.5M5 10.5h8M5 13.5h8"/>', 'Einnahmen (Monat)', 'a39KpiMoney', 'Freigeschaltete Tarife diesen Monat.'),
    ('version', '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', 'Öffentlicher Build', 'a39KpiBuild', '–'),
])
admin = must_sub(r'(\n              </div>\n\n              <div class="settings-card" style="margin-top:1.2rem;">\n                <p class="settings-title">)📊 Kapazität',
    KPIS + r'''\n              </div>
              <div class="a39-grid even">
                <section class="a39-card"><div class="a39-card-h"><div><h2>Neueste Konten</h2><small>Die letzten Registrierungen</small></div><button type="button" class="a39-chip" data-go39="users">Alle Nutzer</button></div><div class="a39-list" id="a39Recent"><p class="a39-empty">Wird geladen …</p></div></section>
                <section class="a39-card"><div class="a39-card-h"><div><h2>Zu erledigen</h2><small>Was gerade auf dich wartet</small></div></div><div id="a39Todo"><p class="a39-empty">Wird geladen …</p></div></section>
              </div>

              <div class="settings-card">
                <p class="settings-title">Kapazität &amp; Limits''', admin)
# Wartung: voraussichtliches Ende, Vorschau, SQL-Hinweis
admin = must_sub(r'(<div id="adminFeatureToggles" class="admin-feature-toggles"></div>)', r'''\1
                <p class="settings-row-label" style="margin-top:1.1rem;">Voraussichtlich zurück</p>
                <div class="a39-until">
                  <input type="datetime-local" id="a39Until" aria-label="Voraussichtliches Ende der Wartung">
                  <button type="button" class="a39-chip" data-until39="30">+30 Min.</button>
                  <button type="button" class="a39-chip" data-until39="60">+1 Std.</button>
                  <button type="button" class="a39-chip" data-until39="120">+2 Std.</button>
                  <button type="button" class="a39-chip" data-until39="0">Kein Ende</button>
                </div>
                <p class="settings-desc" style="margin:.3rem 0 0;">Der Wartungs-Bildschirm zählt bis dahin herunter. Ohne Ende steht dort „Wir sind bald zurück“.</p>
                <p class="a39-sql" id="a39MtSql" hidden>Für das Ende fehlt noch eine Spalte. Einmal im Supabase-SQL-Editor ausführen: supabase/build39.sql</p>''', admin)
admin = must_sub(r'(\n              <div class="settings-card">\n                <p class="settings-title">🔓 Gastzugriff ohne Konto</p>)', r'''
              <div class="settings-card a39-mt-card">
                <p class="settings-title">Vorschau Wartungs-Bildschirm</p>
                <p class="settings-desc">So sehen Besucher die Wartung (mit den Werten von oben, auch ungespeichert). Bei einzelnen Bereichen erscheint derselbe Bildschirm, sobald jemand den Bereich öffnet – mit der Liste, was weiterläuft.</p>
                <div class="a39-prev"><iframe id="a39PrevFrame" title="Vorschau Wartung" loading="lazy" tabindex="-1"></iframe></div>
                <div class="btn-group" style="margin-top:1rem;"><a class="btn btn-secondary" href="wartung.html?vorschau=1" target="_blank" rel="noopener" id="a39PrevOpen">Groß öffnen</a></div>
              </div>\1''', admin)

admin = re.sub(r'(<p class="settings-title">)[^\w<&]+\s', r'\1', admin)
dialogs = '\n'.join([lines(5224, 5234), lines(5428, 5470), lines(5534, 5545), lines(7575, 7591), '<div class="toast" id="toast"></div>'])

# ---------- JS ----------
parts = [
    (9116, 9205),    # Custom Modal + Toast
    (9583, 9672),    # openAdminPanel, switchAdminTab, Changelog
    (9673, 10249),   # Dropdowns, Bestaetigung, Admin-Daten, Formulare, Version (ohne Vorschau-Plakette)
    (10256, 10424),  # Veroeffentlichen, Gastzugriff, Test-Mails
    (10803, 10835),  # Tarife (ACC_PLANS, Limit, fmtEuro, addMonths)
    (11120, 11483),  # Anfragen & Abos
    (11484, 11744),  # Avatar-Baukasten (Anzeige)
    (12073, 12175),  # Profilfotos pruefen
    (12282, 12319),  # Nachrichten, Berlin-Tag, invokeLumiere
    (12372, 12799),  # Coins, Admin-Dialog, Profilbild-Dialog, Galerie, Rundnachricht
    (15867, 15867),  # escapeHtml
    (15950, 16034),  # GAME_DEFS, Medaillons
    (16157, 16193),  # DEFAULT_GAME_SETTINGS, arcadeSettings
    (16430, 16435),  # lbInitials
]
js = '\n\n'.join('// ---- index.html (Build 38) Z. %d-%d ----\n' % ab + lines(*ab) for ab in parts)
js = js.replace("if(tabKey === 'teachers') loadTeachers35();\n", '')
def must_rep(old, new, text, cnt=1):
    if text.count(old) < 1: raise SystemExit('JS-Stelle nicht gefunden: ' + old[:70])
    return text.replace(old, new) if cnt == 0 else text.replace(old, new, cnt)
js = must_rep("label: 'Belohnungen' }", "label: 'Spielhalle' }", js, 0)
js = must_rep("maintenance_mode: globalOn, maintenance_message: message, feature_maintenance: fm,",
              "maintenance_mode: globalOn, maintenance_message: message, feature_maintenance: fm, ...untilPatch39(),", js)
js = must_rep("document.getElementById('adminShell').classList.toggle('sidebar-collapsed');",
              "document.getElementById('adminShell').classList.toggle(innerWidth <= 980 ? 'drawer-open' : 'sidebar-collapsed');", js)
js = must_rep("btn.addEventListener('click', () => { sndClick(); switchAdminTab(btn.dataset.adminTab); });",
              "btn.addEventListener('click', () => { sndClick(); switchAdminTab(btn.dataset.adminTab); closeDrawer39(); window.scrollTo({ top: 0, behavior: 'instant' }); });", js)
js = must_rep("if(document.getElementById('picEditor').hidden) document.documentElement.classList.remove('pic-open');", "document.documentElement.classList.remove('pic-open');", js)
js = js.replace('window.location.origin + window.location.pathname', "location.origin + '/'").replace('location.origin + location.pathname', "location.origin + '/'")

# ---------- CSS: alle Regeln, die Klassen/IDs aus Markup und JS betreffen ----------
style = re.search(r'<style[^>]*>(.*?)</style>', '\n'.join(L), re.S).group(1)
style = re.sub(r'/\*.*?\*/', '', style, flags=re.S)
blob = admin + dialogs + js
tokens = set(re.findall(r'class="([^"$]+)"', blob))
cls = set()
for t in tokens: cls.update(t.split())
cls.update(re.findall(r"classList\.(?:add|toggle|remove)\('([\w-]+)'", blob))
cls.update(re.findall(r"class=\\?\"([\w-]+)", blob))
cls.update(re.findall(r'className\s*=\s*[\'"]([\w -]+)[\'"]', blob))
cls = {c for c in cls if re.match(r'^[\w-]+$', c)}
ids = set(re.findall(r'id="([\w-]+)"', blob))
BASE = re.compile(r'^(\*|html|body|:root|button|input|select|textarea|a|svg|img|h[1-6]|p|table|th|td|tr|label|\[hidden\])\b')
def sel_hit(sel):
    for part in sel.split(','):
        p = part.strip()
        p2 = re.sub(r'^html\.build-38-live\s*', '', p)
        if p2 == '' or p2.startswith(':root'): return True
        if BASE.match(p2) and not re.search(r'[.#]', p2): return True
        for c in re.findall(r'\.([\w-]+)', p2):
            if c in cls and not c.startswith('build-'): return True
        for i in re.findall(r'#([\w-]+)', p2):
            if i in ids: return True
    return False
def block_end(t, i):
    d = 0
    while i < len(t):
        if t[i] == '{': d += 1
        elif t[i] == '}':
            d -= 1
            if d == 0: return i
        i += 1
    return len(t) - 1
outcss = []
def walk(t, wrap):
    i = 0
    while i < len(t):
        j = t.find('{', i)
        if j < 0: break
        pre = t[i:j].strip(); k = block_end(t, j); body = t[j + 1:k]; i = k + 1
        if pre.startswith('@media') or pre.startswith('@supports'):
            walk(body, wrap + [pre]); continue
        if pre.startswith('@keyframes') or pre.startswith('@property') or pre.startswith('@font-face'):
            if not wrap: outcss.append(pre + '{' + body + '}')
            continue
        if pre.startswith('@'): continue
        if sel_hit(pre):
            rule = pre + '{' + body.strip() + '}'
            for w in reversed(wrap): rule = w + '{' + rule + '}'
            outcss.append(rule)
walk(style, [])
css = '\n'.join(outcss)

sh = open(shell, encoding='utf-8').read()
sh = sh.replace('/*@CSS@*/', css).replace('<!--@MARKUP@-->', admin).replace('<!--@DIALOGS@-->', dialogs).replace('/*@JS@*/', js)
open(out, 'w', encoding='utf-8').write(sh)
print('admin.html: %d KB, CSS %d Regeln, %d Klassen' % (len(sh) // 1024, len(outcss), len(cls)))
