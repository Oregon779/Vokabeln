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
Blickpunkt je an der Spitze und am Fuss) - eine halbe Umrundung von oben
nach unten.

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

## Die Drehung kommt vom Scrollen

`scrub()` in index.html zaehlt, zwischen welchen zwei Szenenmitten die
Bildmitte steht, und meldet das ueber `LumiereGL.setTurn(turn)` - eine
Szene = eine volle Umdrehung. In jeder Szenenmitte ist `turn` ganzzahlig,
das Zeichen steht dort also genau von vorn. Im Stand dreht nichts, es
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
