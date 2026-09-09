// Einfacher Service Worker: haelt die App offline nutzbar (stale-while-revalidate).
// Cache-Namen bei groesseren Aenderungen an den gecachten Dateien hochzaehlen,
// damit alte Caches automatisch aufgeraeumt werden.
const CACHE_NAME = 'lumiere-v1';
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
