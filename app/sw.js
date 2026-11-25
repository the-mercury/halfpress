// Offline support. App files come from the network first, so a new version
// shows up the first time the app is opened after a release. The cache is the
// fallback when offline or when the network is slow. Fonts never change, so
// they are served from the cache first.
// Bump VERSION when the list of files below changes.
//
// The live app and the dev preview (under dev/) share one origin, so each
// copy names its cache after its own scope and only clears its own old caches.

const VERSION = "halfpress-v5";
const NETWORK_TIMEOUT_MS = 3000;
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
  "./icons/icon-maskable-512.png",
  "./icons/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
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

  event.respondWith(isFont ? cacheFirst(req) : networkFirst(req, event));
});

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
  return res;
}

async function networkFirst(req, event) {
  const cache = await caches.open(CACHE);
  // "no-cache" asks the server whether the file changed, so the browser's own
  // HTTP cache (ten minutes on GitHub Pages) cannot hold back a release.
  const fresh = fetch(req.url, { cache: "no-cache" }).then((res) => {
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  });
  // Keep the service worker alive until the cache is updated, even if the
  // cached copy was used because the network was slow.
  event.waitUntil(fresh.catch(() => {}));

  const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT_MS));
  const res = await Promise.race([fresh.catch(() => null), timeout]);
  if (res) return res;

  const hit = await cache.match(req, { ignoreSearch: true })
    || (req.mode === "navigate" ? await cache.match("./index.html") : undefined);
  return hit || fresh;
}
