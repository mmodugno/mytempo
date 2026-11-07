// Service worker: la app funciona sin conexión. Primero intenta la red (para ver siempre la última versión)
// y si no hay, responde desde el caché.

const CACHE = "mytempo-v1";
const FILES = [
  ".",
  "index.html",
  "styles.css",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "data/perfil-ejemplo.json",
  "src/engine/time.js",
  "src/engine/energy.js",
  "src/engine/planner.js",
  "src/engine/parse.js",
  "src/store/profile.js",
  "src/store/storage.js",
  "src/ui/app.js",
  "src/ui/state.js",
  "src/ui/dom.js",
  "src/ui/components.js",
  "src/ui/views/ahora.js",
  "src/ui/views/tareas.js",
  "src/ui/views/semana.js",
  "src/ui/views/ajustes.js",
  "src/ui/views/onboarding.js",
  "src/ui/views/tasksheet.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: "no-cache" })
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit ?? caches.match("index.html")))
  );
});
