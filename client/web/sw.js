// Service Worker for PWA installability
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Network-first strategy: always fetch from network, no caching
  event.respondWith(fetch(event.request));
});
