// sw.js
const CACHE_NAME = "code-and-iron-static-v2";

const URLS_TO_CACHE = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.webmanifest",
  "./directory.json",
  "./icon-152.png",
  "./icon-192.png",
  "./icon-512.png"
];

// Install: cache core assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_TO_CACHE);
    })
  );
});

// Activate: cleanup old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : null)))
    )
  );
});

// Fetch: serve from cache first
self.addEventListener("fetch", (event) => {
  const request = event.request;

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