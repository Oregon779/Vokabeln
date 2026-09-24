# Lumière — Arbeitsweise

Einzeldatei-App: alles steckt in `index.html` (Markup, CSS, JS). Kein Build-Schritt.
Entwicklungszweig: `claude/nifty-dijkstra-0e24o4`.

## Immer so arbeiten (Vorgabe des Nutzers)

Gilt für jede Aufgabe, ohne dass der Nutzer es neu sagen muss:

1. **VPS-Befehl nach jedem Push.** Jede Antwort, die mit einem Push endet,
   enthält den Aktualisierungsbefehl (siehe "Deployment") plus den Hinweis
   auf Strg+Shift+R.
2. **Vorher so viele Fragen wie möglich stellen.** Bevor gebaut wird, alle
   offenen Punkte klären (Aussehen, Verhalten, Texte, Sonderfälle, wer es
   sieht, Handy vs. Desktop) - lieber eine Runde Fragen mehr als ein
   Ergebnis, das nicht passt. Mehrere Fragerunden sind ausdrücklich erwünscht.
3. **Visuell testen auf Desktop, Tablet und Handy.** Mit Playwright gegen den
   lokalen Server, mindestens 1440 x 900 (Desktop), 820 x 1180 (iPad) und
   390 x 844 (iPhone), Konsole sauber. Screenshots aller drei an den Nutzer
   schicken - Ergebnisse zeigen, nicht nur behaupten.
4. **Maximal performant.** Ziel sind 60 Bilder/s auch auf Handy und iPad:
   nichts laden, was die Seite nicht gerade braucht (erst bei Bedarf holen),
   keine Dauer-Animationen auf unsichtbaren Seiten, Bilder/Videos klein
   halten, teure Effekte an die Qualitaetsregelung (`governor()`) haengen.
   Bei neuen Effekten die Bildzeit messen und im Ergebnis nennen.

## Deployment

Die Seite läuft auf einem eigenen VPS unter `/var/www/vokabeln`
(Domain `vokabeln.stoneuniverse.de`, davor Cloudflare). Nach jedem Push
gehört dieser Befehl in die Antwort — der Nutzer rollt selbst aus:

```bash
cd /var/www/vokabeln && git pull origin claude/nifty-dijkstra-0e24o4
```

Wegen Cloudflare und Service Worker danach ggf. Hard-Refresh (Strg+Shift+R).

## Freigabe-Gate: neue Sachen erst für Admins

Der Nutzer will Änderungen zuerst allein sehen und sie dann bewusst
freigeben. Deshalb gilt für **jede neue Funktion**:

1. `APP_VERSION` (oben im Script) und `version.json` auf dieselbe neue
   Zahl hochzählen. `version.json` treibt außerdem den
   "Neue Version verfügbar"-Hinweis für offene Tabs.
2. Das Neue im Markup mit `data-build="N"` markieren — N = die neue
   `APP_VERSION`. Normale Nutzer sehen es erst nach der Freigabe,
   Admins sofort.
3. Was dadurch ersetzt wird, bekommt `data-build-old="N"` und
   verschwindet in dem Moment, in dem N freigegeben wird.
4. Reine Umgestaltungen ohne neues Markup: `html.build-N-live` als
   CSS-Hook nutzen statt das Markup zu verdoppeln.

### Update-Check (`initUpdateCheck`)

`version.json` gegen `APP_VERSION`. Was dann passiert, haengt am Nutzer:

- **Normale Nutzer** werden nicht gefragt - die Seite laedt sich selbst neu,
  sobald es nicht hineinplatzt (nicht in `BUSY_VIEWS`, kein offener Dialog,
  keine angefangene Eingabe). Ist es gerade ungelegen, wartet es und holt es
  beim naechsten Seitenwechsel nach (`lumiere:viewchange`).
- **Admins** bekommen weiter den Hinweisbalken und entscheiden selbst.
- **Waehrend der Wartung** passiert gar nichts. `applyMaintenanceMode()` ruft
  ueber `window.lumiereUpdateRecheck()` zurueck, sobald die Wartung endet.

Zwei Fallen dabei:
- `version.json` ist in `sw.js` vom Cache ausgenommen. Ohne das serviert der
  Service Worker es stale-while-revalidate, und ein offener Tab vergleicht
  ewig gegen einen alten Stand - `cache: 'no-store'` im fetch hilft nicht,
  weil die Anfrage vorher durch den Worker laeuft.
- `RELOAD_KEY` in der sessionStorage zaehlt die automatischen Neuladungen.
  Liefert ein Cache noch die alte `index.html`, waehrend `version.json` schon
  die neue Zahl nennt, wuerde sich die Seite sonst endlos neu laden. Nach zwei
  Versuchen bleibt es beim Hinweisbalken.

`applyReleaseGate()` wendet das an — beim Start, bei Profil-/
Einstellungswechsel, beim Abmelden und direkt nach dem Veröffentlichen.
Freigegeben wird im Admin-Panel unter "Version" (schreibt
`site_settings.live_build`); die Vorschau-Plakette unten links führt dorthin.

Ein Element mit `data-build` darf sein `hidden` nicht selbst umschalten —
sonst streiten sich zwei Stellen darum. Im Zweifel einen Hüll-Container nehmen.

**Seit Build 29 gilt: ALLES durchs Gate, auch Neugestaltungen** (Entscheidung
des Nutzers). Build 27/28 liefen noch ohne Gate und waren deshalb sofort
fuer alle sichtbar - das hielt der Nutzer fuer einen Fehler. Bei einer
Neugestaltung also beide Fassungen in der Datei halten (alte mit
`data-build-old`, neue mit `data-build`, IDs der neuen umbenennen) oder
per `html.build-N-live` umschalten. Was sich nicht per Markup gaten laesst
(Icons, Manifest, JS-Verhalten), haengt an `isReleased(N)` - Beispiel:
die Icon-Umschaltung in `applyReleaseGate()`.

## Die 3D-Ebene der Startseite

`lumiere-gl.js` ist ein gebautes Buendel und wird nicht von Hand bearbeitet.
Die Quelle ist `lumiere-gl.src.js`; nach einer Aenderung neu buendeln:

```bash
npm i three@0.186.0 esbuild
npx esbuild lumiere-gl.src.js --bundle --minify --format=iife \
  --target=es2019 --outfile=lumiere-gl.js
```

Zwei Auftritte teilen sich die Szene: das Emblem (Ring, das L als eigener
Glaskoerper, die gekreuzte Schlaufe) und der Eiffelturm. `setProgress(p)`
steuert das Emblem, `setTower(amount, p)` blendet den Turm ein und fuehrt
die Kamerafahrt - beides kommt aus `scrub()` in index.html.

Der Turm ist `tower.glb` (Johnson Martin, Sketchfab, **CC-BY-4.0** - die
Namensnennung in der Schlusszeile `.cine-colophon` ist Lizenzbedingung und darf nicht entfallen). Die
Datei wird erst geholt, wenn die Turm-Szene in Sichtweite kommt. Das
Original war 17 MB mit veralteten specGloss-Materialien, die three.js nicht
mehr laedt; aufbereitet wurde es so:

```bash
npx @gltf-transform/cli metalrough eiffel.glb t1.glb
npx @gltf-transform/cli optimize t1.glb tower.glb --compress meshopt \
  --simplify true --simplify-error 0.004
```

Die Kamerafahrt steht in der Tabelle `TOUR` (Winkel, Hoehe, Abstand und
Blickpunkt je an der Spitze und am Fuss) - seit Build 16 eine GANZE
Umrundung von oben nach unten. Sie endet also auf der Seite, von der sie
kam; nur so kann die Kamera danach einfach zurueckweichen. Nach einer halben
Runde stuende sie hinter dem Turm, mit dem Ruecken zum Zeichen.

## Der Flug zum Turm (ab Build 16)

Der Turm steht in derselben Welt wie das Zeichen, weit dahinter
(`TOWER_AT = (0, 0, -38)`). Nichts wird mehr ueberblendet: die Kamera
FLIEGT beim Scrollen von der Buehne des Zeichens zum Startpunkt der
Turmfahrt, durch das Punktfeld, am Zeichen vorbei (das dabei zuruecktritt,
`eo`). Nach den Karten weicht sie denselben Weg zurueck, der Turm wird
kleiner und verschwindet am Horizont.

- `fadeIn` in `scrub()` dauert genau eine Bildschirmhoehe und endet, wenn
  der Turm-Track festsitzt - der Flug geht nahtlos in die Umrundung ueber.
- Ueberblendet wird die BLICKRICHTUNG (`_dirA`/`_dirB`), nicht der
  Blickpunkt: unterwegs kaeme die Kamera ihrem Zielpunkt sonst so nahe,
  dass sie sich wild wegdreht.
- Nachziehen nur kurz (`smooth(10)` / `smooth(8)`). Das fruehere lange
  Nachlaufen (7 / 3,4) fuehlte sich wie Einrasten an.
- Hochkant (`fit` < 1) schrumpfen auch die Hoehen der Turmfahrt mit, sonst
  schaut die Kamera ueber die Spitze ins Leere.

## Staub an den Straengen (ab Build 17)

Das Punktfeld ueber den ganzen Hintergrund (Build 16) ist wieder raus - in
der Referenz sitzen die Punkte NUR am Zeichen. `makeDust` legt 2400 Punkte
(lite 700) als Wolke um die Straenge: dicht um die Kreuzung, nach unten
breiter streuend, am Ring nur vereinzelt. Gebaut entlang derselben Kurven
wie die Straenge (`helix.userData.curves`), deshalb haengt der Staub am
Zeichen und dreht mit. Er sinkt langsam, blendet dabei ein und aus, und
teilt sich mit `strandGlint` das Glanzlicht (`glint`, `aU`, `aPhase`): wo
es im Strang vorbeilaeuft, leuchtet der Staub daneben warm auf.

## Paris aus Punkten - das "Video" auf dem Weg zum Turm (ab Build 17)

Wie der Wald aus Punkten in der Referenz, nur ohne Videodatei: `makeParis`
baut eine zweite, kleine Szene (Stadtlichter im Strassenraster, sternfoermige
Avenuen, Seine mit flackernder Spiegelung, fahrender Verkehr, Scheinwerfer,
Turm mit Funkeln - `addParisTower` klont dafuer das geladene Modell) und
`renderParis` rendert sie jedes Bild in eine 256 x 144 grosse Textur (lite
128 x 72, jedes zweite Bild). Ein Vorhang aus 200 x 112 Punkten (lite
100 x 56) auf einem Zylinderstueck hinter dem Turm liest daraus Farbe und
Helligkeit; helle Stellen treten nach vorn und werden groesser, Dunkles
bleibt leer. So erkennt man die Stadt schemenhaft. Dazu ein weicher, heller
Schein hinter dem Turm (`shine`).

- Sichtbar nur auf dem Weg (`parisVis`): kommt mit dem Flug, geht, sobald die
  Umrundung beginnt, und ist beim Zurueckweichen wieder da. Gerendert wird
  nur, solange man es sieht.
- Falle: der Horizontschein der kleinen Szene muss HINTER der Stadt liegen
  (er wird mit der Kamera mitgefuehrt). Lag er mitten in ihr, hellte er den
  Boden auf, und der ganze Vorhang wurde zu einer Glitzerwand.

## Die Punkt-Videos (ab Build 18)

Zwei kurze Schleifen von Pexels (freie Lizenz, keine Namensnennung noetig),
auf 320 x 180 verkleinert, ohne Ton, je als MP4 (H.264 - Safari/iPhone) und
WebM (VP9 - der Playwright-Chromium kann kein H.264!):

- `seine.*` (seit Build 21 Pexels 14997474, Louvre/Pavillon de Flore an der
  Seine bei Nacht, Ausschnitt ab 4 s; vorher 15312299 Pont Neuf): der Punktvorhang auf dem
  Weg zum Turm liest daraus statt aus dem Render. Hin und zurueck gespielt
  (Ping-Pong), dadurch ohne Sprung beim Neustart. Faellt das Video aus
  (iPhone im Stromsparmodus spielt nichts automatisch ab), bleibt es beim
  selbst gerenderten Paris - mit Punkt-Turm.
- `tram.*` (Pexels 14757004, Strassenbahn schwarz-weiss): ganz schwach hinter
  dem Zeichen zwischen "Das Wort" und Methode (`tramSheet`, `tramVis`), in
  Gold umgefaerbt (`gold: 1`). Ende blendet in den Anfang ueber (xfade).

**Falle (iPhone/iPad):** das `<video>` haengt unsichtbar (2 px, fast
durchsichtig) im Dokument. Ein Video ausserhalb des Dokuments oder mit
`display:none` dekodiert Safari teils nicht - die Punkte blieben leer.

Beide nutzen `makeVideoSheet` (Punktvorhang auf einem Zylinderstueck;
`uLo`/`uHi` = ab welcher Helligkeit ein Punkt entsteht, `uPush` = wie weit
helle Stellen vortreten). Geholt werden sie erst bei Bedarf (`setVideos` aus
index.html), gespielt nur, solange man sie sieht (`driveVideo`). `sw.js`
laesst .mp4/.webm durch: Videos kommen als Range-Anfragen (206), die der
Cache nicht speichern kann - Safari spielt sie ueber den Worker gar nicht.

Neu kodieren (ffmpeg, z.B. aus `imageio_ffmpeg`):

```bash
ffmpeg -ss 30 -t 18 -i quelle.mp4 -filter_complex "[0:v]fps=20,scale=320:180,split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0,format=yuv420p[v]" -map "[v]" -an -c:v libx264 -crf 29 -preset slow -movflags +faststart seine.mp4
ffmpeg -i seine.mp4 -an -c:v libvpx-vp9 -b:v 0 -crf 40 seine.webm
```

### Video hinter den Punkten (ab Build 19)

Jeder Punktvorhang traegt als Kind ein Bild des Videos selbst
(`makeVideoPlane`, teilt sich uTex/uVis mit dem Vorhang): leicht
weichgezeichnet, additiv, Raender ausgeblendet, die Punkte liegen um
`uFront` davor - wie in der Referenz. **Falle:** ohne steile Tonwertkurve
(`c = max(c - 0.05, 0); c = c*c*2.4`) legte sich das Video wie ein milchiger
Schleier ueber die ganze Nacht. Staerke je Vorhang: `plane` (Seine 0.62,
Strassenbahn 0.42).

## Qualitaetsregelung: 60 Bilder/s auf Handy und iPad (ab Build 19, neu in Build 28)

Seit Build 28 gilt: **erst alles andere, die Aufloesung zuletzt** - der
Nutzer will auf Desktop und iPad nichts Pixeliges sehen.

- **Geraeteklasse** (`tier` in index.html, an `LumiereGL.init` uebergeben):
  `phone` (kurze Bildschirmseite < 600 px oder <= 2 Kerne), `tablet` (grober
  Zeiger), sonst `desktop`. `lite` = phone.
- **Kantenglaettung:** der Composer rendert in ein MSAA-Ziel (`samples` 4,
  Handy 2, HalfFloat). Auf echten GPUs (Apple: auf dem Kachelspeicher) kostet
  das wenig; im Software-Renderer der Testmaschine ist es der groesste Posten.
- **Stufen** (`qualityLevels()`): Bloom halbe Aufloesung -> Partikeldichte
  (`registerDensity`, per drawRange) -> MSAA 2 -> Gold ohne Schillern und
  Klarlack (`simple`, `applyMatQuality`) -> Aufloesung bis `DPR * 0.75`
  (Desktop nie unter 1) -> Bloom aus. Nur das Handy darf zuletzt auf 0.85.
  Start: Desktop Stufe 0, Tablet 1, Handy 2.
- `governor()`: Mittel ueber 40 Bilder; langsamer als 1/54 s -> eine Stufe
  runter (`levelCeil` merkt sich die Grenze), dreimal schneller als 1/58,5 s
  -> eine hinauf. Bildzeiten ueber 0,25 s zaehlen nicht (Tabwechsel, Laden).
- **In Playwright ist die Regelung aus** (`navigator.webdriver`), mit
  `?gov=1` laesst sie sich pruefen. `?q=N` erzwingt eine Stufe (nur zum
  Messen), `LumiereGL._debug` gibt Szene und Renderer heraus.

## Das Zeichen bleibt mittig (ab Build 17)

Wie in der Referenz: kein Springen mehr nach links und rechts. In `KEYS`
steht x ueberall auf 0, y sinkt vom Startbild ueber "Das Wort" bis zur
Methode sanft ab. Der Text weicht auf breiten Schirmen zur Seite
(`html.build-17-live` in index.html: kleineres Wort, Methoden-Notizen an den
rechten Rand). Hochkant sagt die letzte Spalte `top`, welche Szene in den
freien Streifen oben ausweicht (nur das Atelier - dort beginnt der Text oben).

Die Bahn des Emblems steckt in der Tabelle `KEYS` (Scroll-Fortschritt,
Groesse, Position, Drehung je Stuetzstelle) - dort wird nachjustiert, nicht
in der Render-Schleife. Aendert sich die Zahl oder Hoehe der Szenen,
verschieben sich die p-Werte und `KEYS` muss mit.

Der Umriss des L (`L_OUTLINE`) ist **kein handgezeichneter Pfad**, sondern der
echte Glyph aus Fraunces SemiBold Italic (SIL OFL) - derselbe Schnitt wie die
Wortmarke. Ausgelesen mit fontTools, auf Hoehe 1.12 normiert, als flache
Tabelle abgelegt (0 = hingehen, 1 = Linie, 2 = quadratische Kurve). Ein von
Hand nachgezeichnetes L las sich neben dem gesetzten "Lumière" wie ein fremder
Buchstabe. Aendert sich die Schrift der Wortmarke, muss die Tabelle neu
erzeugt werden.

Das Emblem begleitet die ganze Reise; nur der Turm schickt es von der Buehne
(`eo` haengt allein an `towerShown`).

Das Zeichen steht mitten in der Reise **gross hinter dem Text**, nicht mehr
klein daneben. Dafuer nimmt sich die 3D-Ebene dort zurueck: `--gl-op` faellt
ueber `dip` um etwa ein Drittel, sonst kaempft Gold gegen Schrift.

Die x/y in `KEYS` sind fuer den Desktop gedacht. `applyTransform` holt sie auf
den sichtbaren Rand zurueck und schiebt hochkant alles, was seitlich stehen
sollte (grosses |x|), in den freien Streifen ueber den Text - auf dem Handy
ist neben der Schrift kein Platz.

## Die Spirale unter dem Zeichen

`makeHelix` baut die Form aus der Referenz (activetheory.net): zwei Straenge
setzen genau an der linken und rechten Seite des grossen Reifs an und winden
sich mit **gleichbleibendem Radius** (`HELIX_R` = Reifradius) eine **halbe
Drehung** (`HELIX_TWIST = PI`) um die Hochachse. Von vorn kreuzen sie sich
dadurch einmal zum X, von der Seite (Muenze hochkant) bilden sie eine Linse,
die unten zusammenlaeuft - beides ist dieselbe Form. Die Drehung setzt weich
ein (smoothstep), damit die Straenge den Reif senkrecht verlassen. Am Ende
werden die Querschnitte zur Kurvenmitte zusammengezogen, damit der Strang
duenn auslaeuft statt abgeschnitten aufzuhoeren.

Nicht wieder zum Korkenzieher machen (verjuengter Radius, viele Windungen):
das war die vorige Fassung und sah nicht aus wie die Referenz.

## Das Zeichen hat die Buehne (ab Build 15)

Das Zeichen soll mehr Aufmerksamkeit bekommen als alles drumherum:

- **Groesse:** In jeder Szene so gross wie im Startbild. Weil die Szenen
  weiter hinten liegen (z um -2,7), steht in `KEYS` dort ein groesserer
  Massstab (0.54 statt 0.40) - scheinbare Groesse = scale / Abstand zur
  Kamera. Seit Build 27 steht das Startbild kleiner oben (0.30 / y 1.28)
  und der Schluss klein oben (0.21 / y 1.30, top = 1), damit der Text Platz hat.
  Hochkant ruecken seitliche Stuetzstellen auf `halfH * 0.72`.
- **Straenge:** poliertes Gold (Metall, fast keine Rauheit, Klarlack) statt
  Glas, mit harter Fresnel-Lichtkante. Ein Glanzlicht laeuft in 6 s einen
  Strang hinunter (`strandGlint`, `onBeforeCompile`; die Lage entlang des
  Strangs steckt im Attribut `aAlong`, der zweite Strang ist per `aPhase`
  um einen halben Umlauf versetzt). Am Ansatz blendet es erst ein, sonst
  verschmilzt es mit dem Reif zu einem Fleck.
- **Lichthof:** `makeHalo` - ein Sprite (steht immer zur Kamera), additiv,
  hinter dem Zeichen. Am hellsten auf Hoehe des Reifs, innen schwach: ein
  voller Verlauf fuellte den Ring wie eine Muenze und nahm dem L den Kontrast.
- **Schlieren:** 13 statt 26 (lite 5), rund halb so hell. Sie kreisen um das
  Zeichen (`streaks.position` folgt ihm, 1,6 dahinter) und verloeschen, sobald
  sie nach vorn kommen oder im Umriss des Zeichens stehen (`behind()`).
  Sie laufen also nie ueber das Zeichen.
- **Kometen:** nur mit `html.build-15-live` - jeder zweite wird uebersprungen,
  Helligkeit x0.42, kein Lichtschleier mehr unter nahen, Nachruecker warten
  laenger (`cometsCalm()`).

Die 3D-Ebene selbst kennt das Freigabe-Gate nicht; ihre Aenderungen gelten
sofort fuer alle (solange die Wartung laeuft, sieht sie ohnehin nur der Admin).

## Die Drehung kommt vom Scrollen

`scrub()` in index.html zaehlt, zwischen welchen zwei Szenenmitten die
Bildmitte steht, und meldet das ueber `LumiereGL.setTurn(turn)`. Seit Build
17 ist eine Szene eine HALBE Umdrehung: zwischen zwei Szenen dreht sich das
Zeichen auf die Kante (die Straenge werden zur Linse, wie in der Referenz),
in jeder Szenenmitte steht es wieder von vorn. Reif und Straenge sehen nach
einer halben Drehung genauso aus; nur das L waere gespiegelt - es dreht
deshalb nicht voll mit, sondern neigt sich nur bis etwa 20 Grad
(`letter.rotation.y = -spin + sin(spin) * 0.35`). Im Stand dreht nichts, es
schwebt nur (`emblem.position.y += sin(...)`). **Die `KEYS`-Spalte rotY muss
ueberall 0 bleiben** - aufsteigende Winkel dort haben das Zeichen frueher
auf die Kante gestellt. rotX steht bei 0.12, eine kleine Neigung.

## Das Emblem hat drei Ringebenen

Aus der Referenz uebernommen, in Gold statt Cyan - jede Ebene mit eigenem
Takt, das liest sich als Mechanik statt als Wackeln:

- `ringMain` dreht sich in 20 s einmal im Uhrzeigersinn (`rotation.z`).
- `segRing` (aus `makeSegmentRing`) laeuft in 12 s einmal dagegen.
- `pulse` atmet im 2,5-s-Takt, Maszstab 1 → 1.04 → 1, und hebt dabei seine
  `emissiveIntensity` - im Nachgluehen wird daraus ein weicher Puls.

Die Werte sind knapp gehalten: mit `emissiveIntensity` ueber 1 frisst der
Bloom die Form des Zeichens auf, es bleibt ein gelber Klumpen.

## Die Kamera steht nie still

`applyTransform` legt auf die vom Scroll vorgegebene Position ein Driften
(±0.2 / ±0.15 / ±0.28, drei Perioden ohne gemeinsamen Teiler). Waehrend der
Turmfahrt faellt es weg (`idle = 1 - b`), sonst verwackelt es die
inszenierte Kamerafahrt. Der Blickpunkt geht nur zu 35 % mit, damit das
Driften eine Parallaxe erzeugt statt das ganze Bild zu verschieben.

## Ueberblendungen haengen an der Zeit, nicht an der Bildrate

**Wichtig, das war ein echter Fehler:** `towerShown += delta * Math.min(1,
dt * 7)` mit gedeckeltem `dt` liess eine Ueberblendung pro BILD ablaufen.
Bei 60 Bildern/s war der Turm nach einer Sekunde weg, bei 2 Bildern/s erst
nach fuenf - auf einem schwachen Geraet stand er also noch mitten in der
naechsten Szene. Jetzt: `smooth(k) = 1 - exp(-k * dtRaw)`, mit dem echten
dt (nur gegen Sprünge nach einem Tabwechsel bei 0.25 s gedeckelt). Fuer
Bewegung bleibt das gedeckelte `dt`, fuer Ueberblendungen `smooth()`.

## Lichtschlieren und Nachgluehen

Was die Referenz (activetheory.net) teuer aussehen laesst, ist nicht die
Geometrie des Zeichens, sondern was darum herum passiert. Zwei Teile:

- **`makeStreaks` / `updateStreaks`**: Lichtbaender, die in grossen Boegen um
  die Achse ziehen. Jede Schliere ist ein Punkt auf einer Bahn; die Spur ist
  einfach dieselbe Bahn zeitversetzt (`TRAIL_STEP` je Stuetzpunkt), es wird
  also nichts gespeichert. Gezeichnet wird sie als Band aus zwei Streifen -
  Kante (schwarz) zur Mitte (hell) und zurueck. Ein einzelner Streifen haette
  eine harte Kante und saehe nach gezeichnetem Strich aus, nicht nach Licht.
  Bei additiver Ueberlagerung ist Schwarz zugleich das Ausblenden, deshalb
  braucht es keinen Alphakanal pro Ecke.
  Die Bahnen lassen in der Mitte einen Streifen frei (`y0` mit Luecke) und
  liegen bei `z = -2.5`, sonst zieht eine Schliere dicht an der Kamera vorbei
  und fuellt als breites Band das halbe Bild. Kosten: rund 1,3 ms pro Bild
  bei 26 Schlieren, 0,15 ms bei 10 - reines JS, unabhaengig von der GPU.
- **Bloom** (`UnrealBloomPass` im `EffectComposer`): faellt auf schwachen
  Geraeten (`lite`) ganz weg, dort rendert `draw()` direkt.
- **`GradeShader`**: Vignette, Farbsaum und Korn in EINEM Durchgang statt in
  drei. Laeuft nach `OutputPass`, sitzt also auf dem fertigen Bild. Der
  Farbsaum waechst nach aussen (in der Mitte null, sonst flimmert Schrift),
  das Korn wirkt nur in dunklen Flaechen - sonst rauscht das Gold.

## Keine Maus-Effekte mehr (ab Build 14)

Seit Build 14 reagiert nichts auf die Maus: kein eigener Zeiger (Punkt +
Ring), keine Gold-Funken hinter dem Zeiger (`initMouseEmbers`), kein
Lichtschein (`.cursor-spotlight`), kein Hover-Klang auf der Startseite,
keine Neigung des Zeichens, keine Reaktion der Kometen, kein Hover auf den
Tour-Karten. Gesteuert ueber `mouseFxOff()` (= `html.build-14-live`) - die
Klasse steht erst nach dem Laden der Einstellungen fest, deshalb wird bei
jedem Ereignis neu gefragt. Die Karten-Hover auf anderen Seiten (Lernsets
usw.) und die Klick-Rueckmeldung sind davon bewusst nicht betroffen.

## Kometen mit Tiefe

Jeder Komet hat eine Tiefe `d` (0 fern, 1 nah; `pow(random, 1.7)`, also
meist fern). Daran haengen Geschwindigkeit, Strichbreite, Schweiflaenge,
Helligkeit und Kopfgroesse. Nahe (d > 0.5) bekommen einen breiten weichen
Lichtschleier unter dem Kernstrich. Gezeichnet wird hinten zuerst. Beim
Scrollen ziehen nahe Kometen deutlich mit, ferne kaum (`dScroll * (0.03 +
d * 0.55)`) - das macht die Tiefe spuerbar, ohne jede Maus.

## Die Karten am Turm

(Seit Build 28 Milchglas, siehe unten "Build 28". Der Magnet: der Stapel
bleibt um jede Karte herum eine Weile ruhig stehen und wechselt dann
zuegig - `snapT` in step(), nachgezogen nach der Zeit, nicht pro Bild.
Ohne das stand beim Anhalten oft eine Karte halb aus dem Bild, auf dem
Handy mit abgeschnittenem Text.)

Vier Lichtwirkungen, alle ohne Hover: eine Lichtkante, die um die vordere
Karte laeuft (`::before`, konischer Verlauf, `@property --beam-a`), ein
Glanz, der beim Drehen ueber die Karte zieht (`--sheen-x`/`--sheen-o` aus
`layoutDeck`, bei stillstehender Karte aus), ein warmer Hof hinter der
vorderen Karte (`#cineDeckHalo`, `--halo`) und Goldstaub (`#cineDust`,
`drawDust`, nur solange die Turm-Szene sichtbar ist).

## Der Suchscheinwerfer

`makeBeacon` setzt zwei gegenlaeufige Lichtkegel auf die Turmspitze, eine
Umdrehung in 16 s, fast waagrecht (Neigung 0.05) - steiler angehoben liefen
sie nur ueber den oberen Bildrand. Der Shader ist **in der Mitte hell und am
Rand weich** (`pow(|N·V|, 1.6)`); umgekehrt leuchteten die Raender und der
Kegel sah aus wie zwei Klingen. Schaut man in die Oeffnung des Kegels,
blendet er sich aus (`endOn`) - sonst entsteht eine milchige Scheibe.

## Spielhalle: vier Spiele aus Build 20

Mot du jour (`motdujour`), Turmsprung (`tourjump`), 2048 (`g2048`) und
Wort-Laeufer (`wordrun`) sind eigene Umsetzungen bekannter Spielideen - kein
fremder Code, keine fremde Grafik. (Das "Offline HTML Games Pack" von GitHub
ist ohne Lizenz und besteht aus kopierten kommerziellen Spielen - nichts davon
darf auf die Seite.)

- Eintrag in `GAME_DEFS` mit `build: 20`: `arcadeGameVisible()` /
  `visibleGameKeys()` blenden sie bis zur Freigabe aus (Karten, Ranglisten-Tabs,
  Start). Admin-Panel und Rangliste (`game_records`, ohne Namensliste in der
  Datenbank) laufen automatisch mit.
- Vokabeln: `arcadeVocab()` liest die eigenen Lernsets; wer zu wenige hat,
  bekommt `ARCADE_WORDS` dazu. Mot du jour nimmt Woerter mit 4-7 Buchstaben
  (Artikel weg, Akzente fuer das Raten neutralisiert, `arcadeFold`), der
  Wort-Laeufer beliebige kurze Paare.
- Scharf auf Handy/iPad: `arcadeHiDpi()` zeichnet in Geraeteaufloesung. Auf
  schmalen Schirmen (`arcadeNarrow()`, < 640 px) bekommen Mot du jour, 2048 und
  Turmsprung eine eigene Hochkant-Buehne; Zeigerpositionen immer ueber
  `arcadePoint(canvas, e, W, H)` umrechnen.
- Die Tastatur von Mot du jour ist echtes HTML (`.mdj-kb`) unter der Buehne -
  im skalierten Canvas waeren die Tasten zu klein. `stop()` entfernt sie.

## Mein Konto, Tarife und der Passwort-Link (ab Build 22)

Ohne Freigabe-Gate gebaut (Umgestaltung - der Nutzer pullt nach Abnahme der
Screenshots). Das Anmelde-Fenster ist nur noch zum Anmelden/Registrieren da;
angemeldet fuehrt `openAccountModal()` auf die Seite `view-account`
(`openAccountPage()`, Menuepunkt 10, Personen-Symbol oben rechts). Die IDs von
Profil, Status und Sync sind die alten - `updateAccountUI`,
`refreshAccountStatus`, `updateSyncStatusUI` laufen unveraendert darauf.

- **Passwort-Link aus der Mail:** supabase-js wertet `#access_token=...&type=
  recovery` schon beim Erzeugen des Clients aus und meldet `PASSWORD_RECOVERY`
  per setTimeout. `initAuth()` meldete seinen Listener erst nach mehreren
  Netzabfragen an - das Ereignis war dann vorbei, der Link "tat nichts". Jetzt:
  `AUTH_URL_STATE` liest den Anhang VOR `createClient`, ein Listener direkt
  nach dem Client faengt das Ereignis, `initAuth` oeffnet danach
  `openPasswordResetScreen()` (eigene Vollbildseite `#pwResetScreen`, z 9000,
  auch ueber der Wartungstafel). Abgelaufener Link (`#error_code=otp_expired`)
  oder ungueltige Sitzung: dieselbe Seite mit "Neuen Link schicken".
- In Supabase muss unter Auth -> URL Configuration die Domain als Redirect-URL
  stehen, sonst landet der Link auf der Site-URL.
- **Auge:** jedes Passwortfeld traegt `<button class="pw-eye" data-pw-toggle>`
  im selben `.acc-field`/`.auth-field` wie das Feld; ein einziger delegierter
  Klick-Handler schaltet um.
- **Passwort aendern:** prueft das aktuelle Passwort per `signInWithPassword`,
  erst dann `updateUser({ password })`.
- **Tarife** (`ACC_PLANS`): Gratis = `site_settings.ai_daily_limit`, Plus 200
  (2,99 EUR), Pro 1000 (5,99 EUR). Kein Bezahlsystem: "anfragen" schreibt in
  `upgrade_requests` (eine offene Anfrage je Konto, Unique-Index), der Admin
  schaltet unter Nutzer -> "Tarif-Anfragen" frei - das setzt
  `profiles.ai_limit_override`. Der aktuelle Tarif ergibt sich allein aus dem
  wirksamen Limit (`accCurrentPlan`).
- Website-Kapazitaet sieht nur noch der Admin (`#accCapacityRow`).
- Alles deckend (#141922): das alte Fenster war halbtransparent, auf dem Handy
  schien die Startseite quer durch den Text.

## Anfragen & Abos, Mails, Passwort ansehen (ab Build 23)

- **Tarif mit Laufzeit:** `profiles.plan` ('plus'/'pro') + `plan_until`.
  Rangfolge beim Tageslimit, im Server (`increment_ai_usage`) und im Client
  (`accEffectiveLimit`) gleich: `ai_limit_override` > laufender Tarif >
  `site_settings.ai_daily_limit`. Nach `plan_until` also automatisch Gratis,
  ohne Cron. `protect_admin_fields` schuetzt die neuen Spalten.
- **Admin-Tab "Anfragen & Abos"** (`loadAdminAbos`, ein delegierter
  Klick-Handler `onAboClick` auf `#aboRoot`): Freischalten mit 1/3/12
  Monaten (haengt an ein noch laufendes Datum an), Ablehnen mit Grund oder
  Standardtext (`ACC_DEFAULT_REJECT` - derselbe Text steht in der Edge
  Function), Verlaengern (schreibt eine Zeile `kind='verlaengerung'` fuer
  Verlauf und Einnahmen), Wechseln, Beenden. Einnahmen = Summe
  `price_cents` der erledigten Zeilen je Monat (`decided_at`).
- **Mails:** Edge Function `supabase/functions/lumiere-mail` ueber die
  Brevo-API (Secrets `BREVO_API_KEY`, `CRON_SECRET`, optional `MAIL_FROM`,
  `MAIL_REPLY_TO`; "Verify JWT" aus, sie prueft Admin bzw. Cron-Secret
  selbst). Der Client ruft sie nach Freischalten/Ablehnen per
  `sb.functions.invoke`; Erfolg/Fehler landen in `mail_sent_at`/`mail_error`,
  im Verlauf gibt es "Mail senden" zum Nachholen. Erinnerung 3 Tage vor
  Ablauf: pg_cron taeglich 8 Uhr UTC -> `{kind:'reminders'}`, einmal je
  Enddatum (`plan_reminded_for`). SQL: `supabase/build23.sql`.
- **Passwort ansehen:** Supabase kennt nur den Hash. Auf ausdruecklichen
  Wunsch des Nutzers merkt sich die Seite das Passwort beim Anmelden,
  Registrieren, Aendern und Zuruecksetzen in `localStorage`
  (`lumiere_pw_memo`, nur wenn Build 23 freigegeben ist) und loescht es beim
  Abmelden/Loeschen. Unverschluesselt - das Risiko ist mit dem Nutzer
  besprochen, nicht stillschweigend ausweiten (z.B. nie in die Cloud-Sync).
  Beim Anmelden ist das Profil noch nicht geladen (isReleased waere auch fuer
  Admins falsch) - deshalb erst `pwMemoPending`, abgelegt von `flushPwMemo()`
  in `updateAccountUI`. Fehlt es auf einem Geraet, laesst es sich in Mein
  Konto einmal eingeben (`accPwMemoForm`, vorher per signInWithPassword geprueft).
- **Alte Freischaltungen (Build 22)** haben nur `ai_limit_override` gesetzt,
  ohne Tarif/Laufzeit/`decided_at`. `loadAdminAbos` zeigt sie oben in
  "Laufende Abos" (`aboLegacy`, "noch ohne Laufzeit") mit "Laufzeit
  festlegen" (ab heute) oder "Beenden". Das Einzel-Limit von Admin-Konten
  bleibt dabei immer stehen.

## Profilbilder: Avatar-Baukasten + eigenes Foto (ab Build 25)

- **Baukasten** (`AV_CATEGORIES`, `AV_LAYERS`, `AV_FIXED`, `avatarSVG()`):
  SVG im 200er-Raster, Gold-Linien auf Medaillon. Gespeichert wird nur der
  Bauplan (`profiles.avatar_config`, z.B. `{v:1, face:'k-oval', ...}`) mit
  stabilen Teil-IDs. **Neue Kategorie** (Haare, Mund, ...): Eintrag in
  `AV_CATEGORIES` (`key`, `label`, `kind:'shape'|'color'`, `items` mit `id`,
  `draw(item, ctx)`), `key` in `AV_LAYERS` einreihen. Ein gleichnamiger
  fester Teil in `AV_FIXED` (nose/mouth) wird dann ersetzt; alte Bauplaene
  bekommen fuer Neues das erste Element (`avatarNormalize`). Augen/Brauen
  werden fuer das RECHTE Auge um (0,0) gezeichnet, das linke gespiegelt.
  Vorschaukacheln fuer Augen/Brauen schneiden per `thumb`-viewBox aus.
- **Foto:** Zuschnitt im runden Rahmen (ziehen, Regler, Mausrad, zwei Finger),
  Export 512 x 512 WebP (JPEG, wo der Browser kein WebP schreibt). Landet im
  privaten Bucket `avatars-pending/<uid>/...`, Profil bekommt
  `photo_status='pending'`. Freigabe im Admin-Reiter "Profilfotos"
  (`loadPicReviews`, `picApprove`/`picReject`) kopiert die Datei in den
  oeffentlichen Bucket `avatars` und setzt `photo_path`. Admins werden sofort
  freigegeben. Ein altes freigegebenes Foto bleibt sichtbar, bis das neue
  freigegeben ist.
- **Anzeige** (`picSource`/`picHTML`): Foto nur wenn `avatar_kind='photo'` UND
  freigegeben, sonst Avatar, sonst Initialen. Eigenes Bild: `renderOwnPic()`
  (Mein Konto, Kopfleiste, Status-Hinweis) aus `updateAccountUI`. Andere
  (Ranglisten): `fillPics()` ueber die RPC `public_avatars` (gibt nur Bauplan
  und freigegebenes Foto heraus - `profiles` selbst ist fuer Fremde nicht
  lesbar), eine Minute zwischengespeichert. Alles haengt an `isReleased(25)`.
- `protect_admin_fields` laesst Nutzer nur ihr WARTENDES Foto setzen (Pfad im
  eigenen Ordner), nie `photo_path` oder einen anderen Status. SQL:
  `supabase/build25.sql` (Spalten, Buckets, Storage-Policies, RPC).
- Der Editor liegt bei z 60; `#modalBackdrop` (customConfirm) und der Toast
  werden waehrenddessen darueber gehoben (`html.pic-open`).
- Falle: im zweispaltigen Editor braucht jede Spalte `min-width:0`, sonst
  macht die Chip-Reihe das Raster auf dem Handy breiter als den Bildschirm.

## Nachrichten, Sperren und Profilbild-Verwaltung (ab Build 26)

- **Nachrichten** (`user_messages`: kind photo/avatar/plan/reminder/admin,
  tone ok/no/info = Farbe des Punkts, `read_at`, `dedupe`). Nutzer duerfen
  nur lesen, loeschen und `read_at` setzen (Spalten-Grant), schreiben darf
  nur der Admin. Karte `#accMsgCard` ganz unten in Mein Konto vor der
  Gefahrenzone (`loadInbox`/`renderInbox`); `openInbox()` beim Oeffnen der
  Seite setzt alles auf gelesen - die frisch gelesenen bleiben bis zum
  naechsten Laden hervorgehoben. Ungelesene: Zahl am Personen-Symbol
  (`#accountBtnBadge`) und einmal je Sitzung ein Hinweis nach dem Anmelden
  (`inboxLoginToast`, sessionStorage). Bleiben, bis der Nutzer sie loescht.
- **Wer schreibt:** `sendUserMessage()` aus dem Client bei Foto freigegeben/
  abgelehnt, Tarif freigeschaltet/abgelehnt/verlaengert/gewechselt/beendet,
  Loeschen/Sperren/Entsperren und "Nachricht senden". Schlaegt das Speichern
  fehl, laeuft die eigentliche Aktion trotzdem durch. Rundnachricht an alle:
  RPC `send_message_to_all`. Erinnerungen ("laeuft bald ab", "abgelaufen")
  schreibt der pg_cron-Job `lumiere-nachrichten` rein in SQL, doppelt
  geschuetzt ueber `dedupe` + Unique-Index. Die Brevo-Mails aus Build 23
  laufen unveraendert daneben.
- **Sperren je Konto, getrennt:** `profiles.avatar_locked` / `photo_locked`.
  Sperren entfernt das Vorhandene sofort (Avatar-Bauplan bzw. Foto samt
  wartendem Foto und Dateien); `kindAfterRemoval` stellt die Anzeige auf das
  Uebrige um. Im Editor zeigt der gesperrte Reiter `#picLockNote` statt der
  Bedienung (`picTabLocked`), `picSource` zeigt Gesperrtes nie an. Serverseitig
  halten `protect_admin_fields`, `public_avatars` und die Storage-Policy
  dasselbe fest.
- **Admin-Fenster** `#picAdminDlg` (`openPadDlg(uid, {review})`): grosse
  Bilder (wartend / Foto / Avatar), Freigeben/Ablehnen (nur aus der
  Pruefliste), Loeschen, Sperr-Schalter, Einzelnachricht. Ein Grund-Feld fuer
  alles; leer = `PAD_DEFAULT`. Erreichbar ueber das Bild in der Pruefliste,
  das Bild in der Nutzerliste (bzw. "Profilbild & Nachricht" im Menue) und die
  Uebersicht "Alle Profilbilder" (`loadPicGallery`) im Reiter Profilfotos.
  Hochkant bleibt nur das erste Bild gross, die anderen stehen klein daneben.
- SQL: `supabase/build26.sql`. Alles haengt an `isReleased(26)` bzw.
  `data-build="26"`.

## Neue Startseite nach Referenzbild (ab Build 27)

Ohne Freigabe-Gate (Neugestaltung - der Nutzer pullt nach Abnahme der
Screenshots). Ziel: das Zeichen ist schoen, aber der Text soll gelesen werden.

- **Startbild:** Emblem kleiner und oben (`KEYS` erste Zeile: scale 0.30,
  y 1.28), darunter goldene Wortmarke (Verlauf per `background-clip:text`,
  Schatten per `filter:drop-shadow` - `text-shadow` wuerde die durchsichtige
  Schrift verdunkeln), Zierlinie `.cine-ornament`, groesserer Serifentext,
  zwei Knoepfe `.cine-btn` ("Entdecken" scrollt zu "Das Wort", "Jetzt lernen"
  = `btnHubSets`). Der Scroll-Hinweis ist im Startbild aus.
- **Marmor** (`marble.webp`, Handy `marble-s.webp`): prozedural mit numpy
  erzeugt (keine fremde Bildquelle), in der 3D-Ebene als erstes
  bildschirmfuellendes Rechteck (`makeBackdrop`). Der Shader legt einen
  wandernden Schimmer auf die Adern und rechnet die goldenen Linienboegen in
  den Ecken selbst (Einheit = kuerzere Bildseite, sonst laufen sie hochkant
  quer ueber den Schirm). `setHero(scrollY / vh)` aus `scrub()` laesst ihn
  mitziehen und nach einer Bildschirmhoehe in die Nacht uebergehen.
- **Goldwellen** (`makeWaves`, 6000 Punkte, lite 2200): Fasern + Dunst, ganz
  im Shader animiert, haengen an Position/Groesse des Emblems (drehen nicht
  mit). Sichtbar im Startbild und wieder am Ende.
- **Lorbeerkranz** (`makeLaurel`): ein InstancedMesh fuer alle Blaetter, zwei
  Stiele; Kind des Emblems, dreht also mit. Die Straenge sind duenner
  (`thick` 0.03) und im Startbild halb so hell (`hv`), Staub ebenso.
- **Turm:** Funken blitzen einzeln (`makeSparks`, Shader statt gemeinsamem
  Pulsieren), Glut steigt auf und Glitter rieselt (`makeEmbers`).
  (Lichtfaden `makeTrail` und Feuerwerk `makeFireworks` sind seit Build 28
  wieder raus - ersetzt durch Lichtkette und Lichtregen.)
- **Karten** zeigen die echte Seite (`shot-*.webp`). `layoutDeck` laesst
  kommende Karten aus der Tiefe gekippt einfliegen und setzt `--rel`. Neue
  Aufnahmen: Seiten mit echten Daten fuellen (`makePair`,
  `store.examEvents`), sonst steht "NaN" da.
- **Schluss:** kein grosser Footer mehr. `.cine-entrer` zeigt Gaesten
  "Kostenlos starten" (Registrieren/Anmelden oeffnen das Anmeldefenster ueber
  `data-auth-tab`, dazu "ohne Konto ausprobieren"), Angemeldeten "Weiter
  lernen" mit faelligen Woertern (`updateHubStart`). Darunter die schmale
  `.cine-colophon` mit Links und der **CC-BY-Namensnennung des Turms**.
  `KEYS` letzte Zeile: Emblem klein oben (top = 1), Text darunter.

## Build 28: Turm aus Gold-Glas, Milchglas-Karten, die Halle

Ohne Freigabe-Gate (Neugestaltung - der Nutzer pullt nach Abnahme).

- **Weisser Schirm / zaeh am Turm (behoben):** `start()` setzte die Uhr auf 0;
  alles mit Startzeit hielt einen alten Zeitpunkt danach fuer "gerade eben".
  Die Uhr ist jetzt eine eigene kleine (`clock` in init, THREE.Clock ist in
  r186 veraltet) und laeuft beim Neustart weiter. Dazu: kein CSS-`blur()` mehr
  auf den Karten (Schleier `--far` statt Weichzeichner), und `prewarm()`
  uebersetzt die Shader von Turm und Halle gleich nach dem Laden
  (`compileAsync` nur mit KHR_parallel_shader_compile, sonst `compile` -
  ohne diese Pruefung warnt three.js in der Konsole).
- **Turm:** `applyTowerLook` - poliertes Gold mit Schillern und Klarlack
  (Handy: einfaches Metall), Fresnel-Lichtkante in der Farbe der vorderen
  Karte. Deckend, sobald er ganz da ist (`transparent` nur beim Auftauchen,
  beide Fassungen vorab uebersetzt) - spart Mischen und verdeckte Streben.
- **Bluetenwolken** (`makeBlossoms`, `BLOOM_SPOTS`): Hortensien aus deckenden
  Punkten dicht am Gitterwerk. **Lichtkette** (`makeChain`): InstancedMesh aus
  Kettengliedern auf einer Wendel entlang der Kamerabahn, ein Lichtpuls
  (`uHead`) laeuft der Kamera voraus.
- **Farbe je Karte:** `data-theme="#c1 #c2"` an jeder Karte; `layoutDeck`
  meldet sie per `LumiereGL.setTheme(a, b, amt)`. Hintergrund (Glut unten
  links/oben rechts), Turmkante und Blueten nehmen den Ton an; in der Halle
  gleitet es zu warmem Bernstein/Rose (`HALL_TH_A/B`).
- **Karten aus Milchglas:** Glasrand in `--c1/--c2`, darin die App-Seite
  (`shot-*.webp`, 1600 x 1000, DPR 2 ohne Kopfleiste). Auf der vorderen Karte
  fliesst das Bild (`cardLiquid`: EIN kleiner WebGL1-Canvas, der mit der
  vorderen Karte mitwandert, hoechstens 1,5-fache Aufloesung). Titel mit
  Glitch (`cardGlitchA/B`) und Zeichensalat (`scrambleCard`; der Endtext wird
  per setTimeout garantiert, auch wenn die Bildrate stockt). Stichpunkte
  `.cine-card-side` rechts daneben, nur ab 1240 px, so breit wie der Rand.
- **Lichtregen statt Feuerwerk** (`makeRain`, LineSegments) ab
  `tourShown > 0.84`, die Kamera sinkt hinterher in die **Halle**
  (`HALL_AT = (0, -30, -38)`, `makeHall`): Sockel, Kaefig aus Goldstaeben,
  Kabel von der Decke, das L aus Glitzer (`makeGlitterL`, aus dem echten
  Glyphen) mit Spiegelbild im Wasserboden, Lichtkegel, zwei eigene
  Punktlichter. `setHall(hallIn, hallP)` aus `scrub()`: `hallIn` = eine
  Bildschirmhoehe Abstieg nach dem Turm-Track, `hallP` = Weg durch die Halle
  (Atelier -> Kostenlos starten). Der Abstieg ist eine Bezierkurve von der
  Turmkamera zur Hallenkamera.

## Klaenge und Musik (ab Build 28)

Ein AudioContext, erst nach der ersten Beruehrung (`unlockAudio`; vorher
wird nichts geplant, sonst platzt beim ersten Klick alles auf einmal
heraus). Graph: Effekte (`AUD.sfx`) + Hall-Anteil (`AUD.sfxSend` ->
Convolver) und Musik (`AUD.musicFilter` -> `AUD.music`) -> Kompressor.

- **Klangbibliothek `sfx.mp3`** (338 KB, 14 Plaetze: Harfe, Kristall,
  Marimba, Klavier, E-Piano, Pizzicato, Chor, Glas, Halo, Horn, Pauke) aus
  dem **FluidR3-Soundfont (Frank Wen, MIT)** - Nennung in der
  `.cine-colophon`, nicht entfernen. `SPRITE_MAP` = [Beginn, Laenge,
  MIDI-Ton]; den genauen Einsatz sucht `loadSprite` beim Laden (MP3-Vorlauf
  ist je Browser verschieden). `samp()` stimmt per playbackRate um, `inst()`
  faellt auf die erzeugten Stimmen (`voice/bell/pluck`) zurueck, solange die
  Bibliothek fehlt. Neu bauen: `tools/sfx-sprite.py` (numpy + ffmpeg) - die Plaetze
  muessen dann in `SPRITE_MAP` nachgezogen werden.
- **Drossel:** `sndOk(key, gap)` = Mindestabstand je Klang + hoechstens
  sechs Klaenge in 150 ms. `uiSounded()`: hatte ein Klick schon einen eigenen
  Klang (Schalter, Reiter, Absenden, Menue), bleibt `sndClick` stumm.
- **Wo was klingt:** Seitenwechsel (`showView` -> `sndPage`), Menue auf/zu,
  Fenster auf/zu (ein MutationObserver `watchDialogs` fuer alle Dialoge),
  Schalter/Reiter/Regler/Tippen/Absenden (delegiert in der Fangphase),
  richtig/falsch/fertig, Muenzen (`addCoins`), Serie
  (`recordStreakActivity`), Tagesziel (`recordDailyProgress`), Rekord,
  Hinweise (`showToast` -> `sndToast`), Nachricht, Anmelden.
- **Startseite:** `cineSound()` in `scrub()` misst das Scrolltempo
  (`scrollSpeed`, Bildschirmhoehen/s). Tempo -> Scroll-Teppich
  (`sndScrollBed`: Luft + tiefer Grundton, schwillt an und ab, ohne rAF).
  Vier Momente je einmal pro Durchgang: Flug zum Turm, Lichtregen, Abstieg,
  Ankunft - springt die Seite ueber mehrere, klingt nur der letzte; ueber
  5 Bildschirmhoehen/s klingt keiner. Szenen-, Wort- und Kartenklaenge
  schweigen beim schnellen Scrollen (`scrollFast`). Der Wortwechsel ist
  auf Wunsch nur ein Hauch (-45 dB).
- **Musik "Soir à Paris"** (`soir.mp3`, 2 MB, 128 kbit/s): eigenes Stueck,
  Kino + Jazz, 36 Takte bei 72 BPM in D-Dur, gerendert aus denselben
  Samples (`tools/compose-soir.py`). Schleife = 120 s, die Datei ist 7 s laenger (Hall
  klingt aus): `musicArm` startet genau bei 120 s eine zweite Kopie
  (zwei `<audio>` ueber `createMediaElementSource`, `timeupdate` als
  Netz). Geholt erst beim Einschalten; nur Startseite; Standard aus
  (`#hubMusic`, Einstellungen). `musicMood(fc)` aus `cineSound`: oben
  vertraeumt (Tiefpass 2,4 kHz), am Turm voll, in der Halle weicher.
- `sw.js` laesst .mp3 durch (Range-Anfragen, wie Videos). **Test:**
  `python3 -m http.server` kann keine Range-Anfragen - Springen in der Musik
  geht dort nicht. Fuer Musiktests einen Server mit Range nehmen
  (`python3 tools/rangeserver.py 8097 .`, oder nginx).

## Build 29: Footer ueberall, Icon, Sperr-Bildschirm, Admin-Werkzeuge

Alles hinter `data-build="29"` bzw. `isReleased(29)`; Admin-Oberflaeche
sieht der Admin ohnehin sofort. SQL: `supabase/build29.sql`. Die Edge
Function `lumiere-mail` hat zwei neue Auftraege (neu bereitstellen!).

- **Footer auf allen Seiten:** `.site-foot` am Ende von `<main>`, dieselbe
  `.cine-colophon` wie auf der Startseite (inkl. Namensnennungen). Auf der
  Startseite aus (`body.on-hub`, gesetzt in `showView`). Jahr/Version ueber
  `[data-foot-year]`/`[data-foot-version]`.
- **Icon ohne schwarzes Viereck:** `icon-round-*.png` (freigestellter Kreis,
  Tab + Manifest "any"), `icon-touch-180.png` und
  `icon-round-512-maskable.png` (Kreis auf Nachthimmel - iOS/Android fuellen
  Durchsichtiges sonst schwarz/weiss). `applyReleaseGate` tauscht Favicon,
  apple-touch-icon und Manifest (`manifest-29.json`).
- **Sperre mit Grund und Dauer:** `profiles.ban_reason`, `banned_until`
  (null = dauerhaft). Wirksam = `banRunning(p)`; abgelaufene Sperren raeumt
  der pg_cron-Job `lumiere-stuendlich` ab, der Client rechnet selbst auch.
  `#banScreen` (z 9600, alles andere `inert`, kein Abmelden - so gewollt)
  zeigt Grund, Ende und Restzeit. `enforceBan()` beim Laden des Profils und
  jede Minute (eigenes Profil nachsehen). Vor der Freigabe: altes Verhalten
  (Hinweis + Abmelden).
- **Admin-Dialog** `#admUserBackdrop` (`admOpen(mode, p)`, `admSave`):
  `rename` (Name + Grund + "darf nicht mehr selbst aendern" =
  `name_locked`), `password` (setzt per Edge Function
  `{kind:'set_password'}` - braucht den Service-Schluessel; das Passwort wird
  nirgends gespeichert und steht NICHT in der Nachricht), `reset`
  (`resetPasswordForEmail` direkt aus dem Browser), `ban` (Grund + Dauer).
  Jede Aktion schreibt eine Nachricht an den Nutzer. **Passwoerter ansehen
  gibt es bewusst nicht** - Supabase kennt nur den Hash, und Klartext
  mitzuschneiden waere ein Sicherheits-/DSGVO-Problem (mit dem Nutzer so
  besprochen).
- **Name:** das Profil ist massgeblich. `loadOrCreateProfile` schreibt den
  Namen nicht mehr aus den Metadaten zurueck (sonst war eine Umbenennung
  beim naechsten Anmelden weg), sondern gleicht umgekehrt die Metadaten an.
  `protect_admin_fields` haelt `name_locked` fest; Trigger ziehen den Namen
  in `game_records` nach (Ranglisten), und `game_records.display_name` kommt
  immer aus dem Profil.
- **KI-Limit:** der Tag zaehlt nach deutscher Zeit (`increment_ai_usage`,
  `berlinToday()`); ein Zaehler von gestern zeigt 0 (`aiUsedToday`), der
  Stunden-Job setzt ihn auch in der Datenbank zurueck. Im Admin-Menue:
  "KI-Anfragen heute auf 0" und "Eigenes KI-Limit entfernen" (frueher hiess
  das missverstaendlich "Limit zuruecksetzen").
- **Test-Mails:** ein Knopf, Edge Function `{kind:'test'}`: 3 Brevo-Vorlagen
  + 5 Supabase-Vorlagen an die eigene Adresse; wo Supabase eine fremde
  Adresse braucht, ein `+`-Alias, das Hilfskonto wird sofort geloescht.
  Ergebnis je Mail als Liste. Supabase-Standardversand drosselt stark.
- **Handy-Breite (Fehler seit laengerem):** `.page-glow` ragte ueber den
  Rand, die Seite war auf dem iPhone 431 statt 390 px breit, Kopfleiste
  angeschnitten. Jetzt `.view{overflow-x:clip}`.

## Build 30: Schwarzer Schirm, Karten-Videos, Ouverture, alles krasser

Alles Neue haengt am Gate (`data-build="30"`, `html.build-30-live`,
`isReleased(30)`, in der 3D-Ebene `LumiereGL.setFeatures({ b30 })` aus
`applyReleaseGate` und nach `init`). Ausnahme: der Schwarzbild-Schutz gilt
sofort fuer alle.

- **Schwarzer Schirm am Turm (behoben):** Ein einzelnes NaN/Inf im
  HalfFloat-Bild (Klarlack mit sehr kleiner Rauheit) wurde vom Bloom ueber
  alle Mip-Stufen zu grossen schwarzen Rechtecken verschmiert. Jetzt reinigt
  der Hochpass des Bloom selbst (`okc()` in `materialHighPassFilter`, kein
  eigener Durchgang), `GradeShader` reinigt seine Abtastungen, die
  Klarlack-Rauheit ist nicht mehr extrem klein. Nur falls three.js den
  Hochpass-Shader einmal anders schreibt, faellt es auf `SanitizeShader`
  als eigenen Pass zurueck. Pruefen: `inj30.js`-Muster - ein NaN-Pixel per
  Shader einschleusen; Build 29 wird schwarz, Build 30 nicht.
- **DE/EN-Umschalter weg** (`data-build-old="30"`), **Titel-Zeichensalat
  weg** (`scrambleCard` tut ab 30 nichts).
- **Karten mit Video der Bedienung:** `card-<name>.{mp4,webm,webp}`
  (1120 x 700, 5-13 s, Schleife mit Ueberblendung, leicht weich). Hinten das
  Video, davor Milchglas (`.cine-card-glass::after`), vorn Titel mit Glanz.
  Gespielt wird nur die vordere Karte (`cardVideo.update` aus `step()`),
  Nachbarn bekommen nur das Poster; geladen erst bei Bedarf. Neu aufnehmen:
  `tools/cards/` (CDP-Screencast in Echtzeit mit Beispieldaten aus
  `seed.js`, dann `encode.py`).
- **Musik "Ouverture"** (`ouverture.mp3`, `tools/compose-epic.py`):
  Kino-Trailer in d-Moll/D-Dur, 100 BPM, 32 Takte = 76,8 s Schleife (+6,5 s
  Nachhall). Streicher-Ostinato (Legato-Samples ab 0,36 s angespielt, sonst
  zu weich - `off=` in `note()`), Horn-Thema, Trompete im Dur-Teil, Taiko,
  Pauken, Chor, zwei grosse Schlaege (Takt 16 und 28, selbst erzeugter
  Tiefton `boom()`), Paris-Motiv am Klavier zum Schluss. Welche Datei
  spielt: `MUSIC_TRACKS` / `musicTrack()`; wechselt das Gate, verwirft
  `musicStart` die alten `<audio>`.
- **3D (alles in `lumiere-gl.src.js`, Block "Build 30: krasser"):**
  Strahlen + Energie-Puls hinter dem Zeichen (`makeHeroFx`), Bokeh
  (`makeBokeh`), Lichtblitz mit Linsenschweif (`flashAt`, GradeShader
  `uFlash/uFlare` - bei Kante des Zeichens, Ankunft am Turm, Abstieg,
  fertigem L; mind. 1,2 s Abstand), Fokus-Zieher (`uBlur`, Mitte scharf,
  ab Stufe 5 aus), Goldsturm (`makeStorm`, Striche im Kamera-Raum),
  Nachthimmel mit Mond, Sternen, Wolken (`makeSky`, Kugel um den Turm,
  Wolken-Oktaven 3 / Handy 2), Nachtbeleuchtung des Turms (`towerNight` im
  Turm-Shader), Funkeln zur vollen Stunde (`sparkBurst`: echte Minute < 5,
  sonst alle 26 s kurz), Lichtschweife (`makeTrails`), Kamera naeher mit
  Schraeglage und weiterem Blickwinkel im Flug (`TOUR30`, `updateFx30`),
  Halle mit Lichtsaeulen hinter dem Kaefig (`makeColumns`), Gewoelbe aus
  Saeulen und Boegen im Dunst (`makeNave`, instanziert + gespiegelt),
  Regenringe im Wasser (`uDrops`, nur nahe am Kaefig), das L baut sich aus
  einem Wirbel auf (`uSwirl`; 30 % beim Ankommen, der Rest bis "Kostenlos
  starten"). **Falle:** alles hier rechnet in linearem Licht vor der
  Tonwertkurve - Dunst/Himmel ueber ~0,03 sieht nach Tonemapping beige aus.
- **Text-Auftritt / Glanz (CSS):** Zeilen einer Szene kommen gestaffelt aus
  der Unschaerfe (`--e` aus `--enter` minus `--i` je Zeile); ueber Wortmarke
  und "Kostenlos starten" laeuft alle 7 s ein Glanz (`titleShine30`).
- **Vorwaermen der Shader repariert (galt schon seit Build 28 nicht):**
  `renderer.compile` uebergeht unsichtbare Objekte, und ohne Ziel wurden die
  Bildschirm-Fassungen statt der Composer-Fassungen uebersetzt. `prewarm()`
  blendet Turm/Halle/Wirkungen fuer den Durchlauf kurz ein und setzt
  `composer.readBuffer` als Ziel. Pruefen: `renderer.info.programs.length`
  vor und nach der ganzen Reise - es darf nichts dazukommen (jetzt 46 -> 46,
  vorher kamen 18 mitten im Flug dazu).
- Bildzeit (Software-Renderer der Testmaschine, nur relativ): Startbild und
  Turm etwa gleich wie Build 29, Halle rund +30 %, Flug zum Turm ohnehin
  guenstig.

## Testen mit Freigabe-Gate

Lokal gibt es kein Supabase, also ist niemand Admin und alle Build-14-Teile
sind versteckt. Im Test deshalb nach dem Laden:
`currentProfile = { is_admin:true }; applyReleaseGate();`
Und: die Seite scrollt weich (`scroll-behavior:smooth`). Bei der niedrigen
Bildrate der Testmaschine kommt ein `scrollTo` erst Sekunden spaeter an -
Szenen sehen dann unscharf aus, obwohl alles stimmt. Fuer Standbilder
`scrollTo({ top, behavior:'instant' })` nehmen.

**Falle:** `Float32BufferAttribute` legt eine **Kopie** des uebergebenen
Feldes an. Wer den Puffer jeden Frame neu beschreibt, muss mit
`geo.attributes.<name>.array` arbeiten - schreibt man in das hineingereichte
Feld, bleibt das Mesh leer und es gibt keine Fehlermeldung.

**Falle:** Mit Bloom rendert die Szene deckend (`scene.background`), ein
Nachbearbeitungspass und ein durchscheinender Kanal vertragen sich schlecht.
Die Grundfarbe kommt deshalb als `bg` aus `index.html` (dort aus `--bg`
gelesen) - optisch derselbe Ton wie der Rest der Seite, nur eben deckend.

Zwei Fallen, die schon einmal Zeit gekostet haben:
- `overflow-x` auf `<body>` zwingt `overflow-y` auf `auto`. Damit wird
  `<body>` zum Scrollcontainer und jedes `position:sticky` klebt nicht mehr.
  Die Sperre gehoert auf `<html>`.
- Das reicht Mobil-Browsern aber nicht: ragt etwas (die Turm-Karten per
  3D-Transform) ueber den Rand, machen sie die Seite breiter und zoomen
  heraus - Kopfleiste und Fenster waren rechts angeschnitten. Deshalb
  `.view-cine{overflow-x:clip}` (clip, nicht hidden: kein Scrollcontainer,
  sticky bleibt).
- Der Kaertchen-Stapel steht in einem `perspective`-Container. Alle Kaertchen
  liegen hinter z=0, der Container selbst davor - ohne
  `pointer-events:none` auf dem Container faengt er jeden Klick ab.

Wichtig bei jedem Deploy, sonst bekommen Nutzer ein altes Buendel zu neuem
Markup (daher kam einmal "LumiereGL.setTower is not a function"):
- `CACHE_NAME` in `sw.js` hochzaehlen
- den Versionsanhang im Script-Tag mitziehen:
  `<script src="./lumiere-gl.js?v=N" defer>` - der Dateiname aendert sich nie,
  ohne den Anhang liefern Cloudflare und Browser-Cache die alte Datei aus.

Der Kaertchen-Stapel ist eine Wendel: jedes Kaertchen steht fest an seinem
Platz (`placeCards`), bewegt wird die Welt darum (`layoutDeck`), genau
gegenlaeufig zur Kamera. Die Kaertchen brauchen dafuer `transform-origin:0 0` -
mit dem voreingestellten Mittelpunkt heben sich die beiden Drehungen nicht
auf und die vorderste Karte wandert seitlich weg.

## Vor jedem Commit

Mit Playwright gegen einen lokalen `python3 -m http.server` testen —
Desktop und Handybreite, Konsole muss sauber sein. Der Nutzer erwartet
Screenshots vom Ergebnis, keine Behauptungen.

Serverseitiges (Supabase-SQL, Brevo, nginx) kann hier nicht ausgeführt
werden: als fertigen Schnipsel mitliefern.
