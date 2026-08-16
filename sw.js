const CACHE_NAME = 'mein-kalorientracker-shell-v5-1';
const HTML_FALLBACK = './index.html';
const STATIC_ASSETS = [
  './manifest.webmanifest',
  './icon-192.svg',
  './icon-512.svg'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).catch(() => undefined)
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isNavigation = request.mode === 'navigate' ||
    url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');

  if (isNavigation) {
    // HTML immer zuerst frisch vom Netz holen. Nur offline auf die letzte funktionierende Version zurückfallen.
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request, { cache: 'no-store' });
        if (fresh && fresh.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(HTML_FALLBACK, fresh.clone());
        }
        return fresh;
      } catch (err) {
        const cached = await caches.match(HTML_FALLBACK);
        if (cached) return cached;
        throw err;
      }
    })());
    return;
  }

  // Eigene statische Dateien ebenfalls network-first, damit Updates nicht an alten Cache-Dateien hängen bleiben.
  event.respondWith((async () => {
    try {
      const fresh = await fetch(request, { cache: 'no-store' });
      if (fresh && fresh.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, fresh.clone());
      }
      return fresh;
    } catch (err) {
      const cached = await caches.match(request);
      if (cached) return cached;
      throw err;
    }
  })());
});
