// Service Worker: haelt die App offline nutzbar.
// WICHTIG: CACHE_NAME bei jedem Deploy mit inhaltlichen Aenderungen hochzaehlen -
// sonst bleiben Nutzer (v.a. als "Zum Home-Bildschirm hinzugefuegt" auf iOS)
// unter Umstaenden dauerhaft auf einem alten, kaputten Stand haengen.
const CACHE_NAME = 'lumiere-v2';
const APP_SHELL = ['./', './index.html', './manifest.json'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // KI-Anfragen (Gemini/Claude) nie cachen — die sollen immer live gehen.
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('anthropic.com')) return;
  // Nur eigene Herkunft cachen, keine fremden Ressourcen (z.B. Google Fonts) mitschneiden.
  if (url.origin !== self.location.origin) return;

  // Die eigentliche App-Seite (HTML-Navigation) IMMER zuerst frisch aus dem Netz
  // laden statt aus dem Cache - sonst haengen v.a. installierte iOS-PWAs auf
  // einem alten Stand fest, obwohl laengst ein Update online ist. Der Cache
  // dient hier nur noch als Offline-Fallback, falls kein Netz verfuegbar ist.
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // Alles andere (Icons, Manifest, ...) bleibt stale-while-revalidate, da hier
  // Aktualitaet weniger kritisch ist als schneller Offline-Zugriff.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
