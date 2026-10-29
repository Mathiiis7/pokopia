// Garde une copie des fichiers pour ouvrir l'appli sans réseau.
// Toujours le réseau d'abord : une mise à jour en ligne se voit tout de suite.
const CACHE = "pokopia-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (ev) => {
  ev.waitUntil(caches.keys().then((cles) => Promise.all(cles.filter((c) => c !== CACHE).map((c) => caches.delete(c)))));
  self.clients.claim();
});

self.addEventListener("fetch", (ev) => {
  const url = new URL(ev.request.url);
  if (ev.request.method !== "GET" || url.origin !== location.origin) return;
  ev.respondWith(
    fetch(ev.request)
      .then((rep) => {
        if (rep.ok) { const copie = rep.clone(); caches.open(CACHE).then((c) => c.put(ev.request, copie)); }
        return rep;
      })
      .catch(() => caches.match(ev.request, { ignoreSearch: true }))
  );
});
