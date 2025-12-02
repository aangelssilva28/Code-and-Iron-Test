// sw.js
const CACHE_NAME = "code-and-iron-static-v1";

const URLS_TO_CACHE = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.webmanifest",
  // Add your icons if you have them:
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// Install: cache core assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches if you bump CACHE_NAME
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for our core files, network fallback
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only handle GET
  if (request.method !== "GET") return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      // Otherwise go to the network and (optionally) cache new files
      return fetch(request).then((response) => {
        // Don’t cache opaque or error responses
        if (!response || response.status !== 200 || response.type === "opaque") {
          return response;
        }

        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseClone);
        });

        return response;
      });
    })
  );
});