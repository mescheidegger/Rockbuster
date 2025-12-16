const CACHE_NAME = 'rockbuster-v1';

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/src/main.js',

  // sprite atlases
  '/assets/sprites/shipsandufos.json',
  '/assets/sprites/shipsandufos.png',
  '/assets/sprites/Meteors/meteors.json',
  '/assets/sprites/Meteors/meteors.png',

  // add others as needed
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        // Cache sprite/audio assets on demand
        if (request.url.includes('/assets/')) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
