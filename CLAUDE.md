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

## Vor jedem Commit

Mit Playwright gegen einen lokalen `python3 -m http.server` testen —
Desktop und Handybreite, Konsole muss sauber sein. Der Nutzer erwartet
Screenshots vom Ergebnis, keine Behauptungen.

Serverseitiges (Supabase-SQL, Brevo, nginx) kann hier nicht ausgeführt
werden: als fertigen Schnipsel mitliefern.
