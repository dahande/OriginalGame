const CACHE_NAME = 'aomori-apple-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './og-image.png',
  './src/main.js',
  './src/apple.js',
  './src/audio.js',
  './src/world.js',
  './src/storage.js',
  './src/particles.js',
  './src/styles.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
          return null;
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});
