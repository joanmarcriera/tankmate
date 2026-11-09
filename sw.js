/* Tankmate service worker — offline-first cache. Bump VERSION to invalidate. */
const VERSION = 'tankmate-v3';
const ASSETS = ['.', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest', 'icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Stale-while-revalidate for same-origin GETs: answer from cache instantly (works
// offline), and refresh the cached copy from the network in the background, so a
// deploy reaches users on their next load even when VERSION was not bumped.
// Only successful same-origin responses are cached — never a 404/500 or a
// third-party script. Cross-origin requests are left to the browser.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const network = fetch(req).then(res => {
    if (res && res.ok && res.type === 'basic') {
      const copy = res.clone();
      return caches.open(VERSION).then(c => c.put(req, copy)).catch(err => console.warn('Tankmate SW: cache write failed', err)).then(() => res);
    }
    return res;
  });
  e.waitUntil(network.catch(() => {}));
  e.respondWith(
    caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then(hit => hit || network.catch(() =>
      // Offline and not cached: only a page navigation gets the app shell; a
      // missing script or image must fail as itself, not as HTML.
      req.mode === 'navigate'
        ? caches.match('index.html').then(r => r || Response.error())
        : Response.error()))
  );
});
