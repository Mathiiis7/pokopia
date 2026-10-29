// Garde une copie des fichiers pour ouvrir l'appli sans réseau.
// Toujours le réseau d'abord : une mise à jour en ligne se voit tout de suite.
const CACHE = "pokopia-v2";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (ev) => {
  ev.waitUntil(caches.keys().then((cles) => Promise.all(cles.filter((c) => c !== CACHE).map((c) => caches.delete(c)))));
  self.clients.claim();
});

self.addEventListener("fetch", (ev) => {
  const url = new URL(ev.request.url);
  if (ev.request.method !== "GET" || url.origin !== location.origin) return;
  ev.respondWith(
    // « no-cache » : le navigateur redemande toujours au serveur s'il y a du neuf (GitHub Pages
    // garde sinon les fichiers 10 minutes) ; sans changement, la réponse est minuscule
    fetch(ev.request, { cache: "no-cache" })
      .then((rep) => {
        if (rep.ok) { const copie = rep.clone(); caches.open(CACHE).then((c) => c.put(ev.request, copie)); }
        return rep;
      })
      .catch(() => caches.match(ev.request, { ignoreSearch: true }))
  );
});
