# Lumière — Arbeitsweise

Einzeldatei-App: alles steckt in `index.html` (Markup, CSS, JS). Kein Build-Schritt.
Entwicklungszweig: `claude/nifty-dijkstra-0e24o4`.

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

**Ausnahme — komplette Neugestaltung einer bestehenden Seite:** dafür
taugt das Gate nicht (beide Fassungen müssten gleichzeitig in der Datei
liegen, mit doppelten Element-IDs). In dem Fall **vorher fragen**, ob der
Nutzer erst nach seiner Abnahme pullt oder den doppelten Aufwand will.

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
Namensnennung im Footer ist Lizenzbedingung und darf nicht entfallen). Die
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

- `seine.*` (Pexels 15312299, Pont Neuf bei Nacht): der Punktvorhang auf dem
  Weg zum Turm liest daraus statt aus dem Render. Hin und zurueck gespielt
  (Ping-Pong), dadurch ohne Sprung beim Neustart. Faellt das Video aus
  (iPhone im Stromsparmodus spielt nichts automatisch ab), bleibt es beim
  selbst gerenderten Paris - mit Punkt-Turm.
- `tram.*` (Pexels 14757004, Strassenbahn schwarz-weiss): ganz schwach hinter
  dem Zeichen zwischen "Das Wort" und Methode (`tramSheet`, `tramVis`), in
  Gold umgefaerbt (`gold: 1`). Ende blendet in den Anfang ueber (xfade).

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

## Qualitaetsregelung: 60 Bilder/s auf Handy und iPad (ab Build 19)

`governor()` misst jedes Bild die echte Bildzeit (Mittel ueber 40 Bilder).
Zu langsam (> 1/52 s): erst Aufloesung runter bis 1.0, dann Bloom aus
(`bloomOn`, `draw()` rendert dann direkt), dann Aufloesung weiter bis 0.6.
Drei gute Messungen (< 1/58 s) in Folge: eine Stufe hinauf, aber nie ueber
die Stufe, an der es zuletzt zu langsam wurde (`prCeil`). Deshalb gibt es
den Bloom jetzt auch auf `lite` - die Regelung nimmt ihn weg, wenn das
Geraet ihn nicht schafft. **In Playwright ist die Regelung aus**
(`navigator.webdriver`), weil die Testmaschine ohne Grafikkarte rendert und
alles herunterregeln wuerde; mit `?gov=1` laesst sie sich trotzdem pruefen.

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
  Kamera. Das Startbild steht bei y 1.30, damit die Kopfleiste den Reif
  nicht anschneidet; der Schluss bei 0.37 / y 0.95 (naeher an der Kamera).
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
