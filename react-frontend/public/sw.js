/* global workbox */
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.1.0/workbox-sw.js');

if (workbox) {
  workbox.core.clientsClaim();
  workbox.core.skipWaiting();

  workbox.routing.registerRoute(
    ({ request }) => ['style', 'script', 'font', 'image'].includes(request.destination),
    new workbox.strategies.CacheFirst({
      cacheName: 'static-assets',
      plugins: [new workbox.expiration.ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 })],
    }),
  );

  workbox.routing.registerRoute(
    ({ url }) => url.pathname.startsWith('/api/'),
    new workbox.strategies.NetworkFirst({
      cacheName: 'api-cache',
      networkTimeoutSeconds: 4,
      plugins: [new workbox.expiration.ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 10 })],
    }),
  );

  workbox.routing.registerRoute(
    ({ request }) => request.mode === 'navigate',
    async () => {
      try {
        return await fetch('/');
      } catch {
        return caches.match('/offline.html');
      }
    },
  );

  workbox.routing.setCatchHandler(async ({ event }) => {
    if (event.request.destination === 'document') {
      return caches.match('/offline.html');
    }
    return Response.error();
  });
}
