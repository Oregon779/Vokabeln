# Baut start.html (Gaeste-Startseite der App, Build 38) aus der v14-Startseite
s = open('lumiere-startseite-v14.html').read()
def R(a, b, n=1):
    global s
    assert s.count(a) == n, (s.count(a), a[:90]); s = s.replace(a, b)
R('<title>Lumière – Die Wörter von Freitag</title>', '<title>Lumière – Vokabeltrainer Deutsch · Französisch</title>\n<meta name="robots" content="noindex">')
# Glas-L nur beim ersten Oeffnen pro Sitzung - danach startet die Seite sofort
R("    var quick = false; try{ quick = !!sessionStorage.getItem('lum-load'); sessionStorage.setItem('lum-load', '1'); }catch(e){}",
  "    var quick = false; try{ quick = !!sessionStorage.getItem('lum-load'); sessionStorage.setItem('lum-load', '1'); }catch(e){}\n    if(quick){ if(loader.parentNode) loader.parentNode.removeChild(loader); return; }")
# Bruecke zur App: Knoepfe und Links melden sich beim Elternfenster (index.html)
bridge = '''<script>
(function(){
  // In der App laeuft diese Seite in einem iframe. Knoepfe und Footer-Links fuehren dann nicht
  // auf Anker, sondern sagen der App Bescheid (Registrieren, Anmelden, Gast, Seitenwechsel).
  var emb = window.parent && window.parent !== window;
  var GO = { '#lernsets':'home', '#spielhalle':'rewards', '#klassen':'classes', '#konto':'account', '#datenschutz':'about', '#impressum':'about' };
  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('a'); if(!a || !emb) return;
    var act = a.getAttribute('data-action'), go = GO[a.getAttribute('href') || ''];
    if(!act && !go) return;
    e.preventDefault();
    try{ parent.postMessage({ lumiere:act || 'goto', view:go || null }, location.origin); }catch(err){}
  });
})();
</script>
'''
R('</body>', bridge + '</body>')
open('/home/user/Vokabeln/start.html', 'w').write(s)
print('start.html', len(s))
