// Offline support. App files are served from the cache and refreshed in the
// background, so a new catalog or app version shows up on the next open.
// Bump VERSION when the list of files below changes.
//
// The live app and the dev preview (under dev/) share one origin, so each
// copy names its cache after its own scope and only clears its own old caches.

const VERSION = "halfpress-v3";
const SCOPE = self.registration.scope;
const CACHE = `${VERSION} ${SCOPE}`;
const PREVIEW = new URL("dev/", SCOPE).href;
const CORE = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./data/catalog.json",
  "./js/main.js",
  "./js/catalog.js",
  "./js/dom.js",
  "./js/kit.js",
  "./js/optics.js",
  "./js/scenes.js",
  "./js/views/scenes.js",
  "./js/views/lens.js",
  "./js/views/exposure.js",
  "./js/views/timer.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE && (k.endsWith(` ${SCOPE}`) || !k.includes(" "))).map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (url.origin !== self.location.origin && !isFont) return;
  // The live app leaves the dev preview to its own service worker.
  if (url.href.startsWith(PREVIEW)) return;

  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req, { ignoreSearch: true }).then((hit) => {
        const fresh = fetch(req)
          .then((res) => {
            if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
            return res;
          })
          .catch(() => hit || (req.mode === "navigate" ? cache.match("./index.html") : undefined));
        return hit || fresh;
      }),
    ),
  );
});
