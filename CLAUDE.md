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

Das Emblem begleitet die ganze Reise; nur der Turm schickt es von der Buehne
(`eo` haengt allein an `towerShown`). Alle `FLOURISH_EVERY` Sekunden macht es
eine Pirouette: `advanceSpin()` integriert eine Glockenkurve, die ueber die
Dauer genau 2*PI ergibt - danach steht es wieder von vorn. Der Kipper waehrend
der Drehung ist `sin(2*PI*u)`, nicht `sin(PI*u)`: sein Maximum muss auf die
Viertelumdrehung fallen, wo der Reif sonst auf der Kante stuende und fast
verschwinden wuerde.

Die x/y in `KEYS` sind fuer den Desktop gedacht. `applyTransform` holt sie auf
den sichtbaren Rand zurueck und schiebt hochkant alles, was seitlich stehen
sollte (grosses |x|), in den freien Streifen ueber den Text - auf dem Handy
ist neben der Schrift kein Platz.

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
