// Self-destroying service worker.
//
// This app does not ship a service worker. However, some browsers may still
// hold a stale registration from earlier development and keep requesting
// `/sw.js` on every load (producing the `GET /sw.js 404` noise). Serving this
// file returns a valid 200 and lets those clients unregister themselves and
// drop any old caches, so the request stops happening.

self.addEventListener("install", () => {
  // Activate immediately instead of waiting for existing clients to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        await self.registration.unregister();

        // Clear any caches a previous service worker may have created.
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));

        // Reload open tabs so they run without the (now removed) worker.
        const clients = await self.clients.matchAll({ type: "window" });
        for (const client of clients) {
          client.navigate(client.url);
        }
      } catch {
        /* best-effort cleanup; ignore failures */
      }
    })()
  );
});
