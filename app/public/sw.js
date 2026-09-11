/* Barashada Ingiriisiga service worker — offline app shell + runtime asset cache.
   Bump CACHE when the shell changes to force an update. */
const CACHE = 'barashada-v3';
const OFFLINE = 'barashada-offline';   // user-downloaded content (readers + audio) — preserved across updates
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/pwa-192.png', '/pwa-512.png'];

self.addEventListener('install', (e) => {
  // Do NOT skipWaiting here: a new SW stays "waiting" so the page can show an
  // update prompt and activate it on the user's command (see SKIP_WAITING below).
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    // Keep the current shell cache AND the offline-downloads cache; drop old shells.
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== OFFLINE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// The page posts this when the user accepts the "new version" prompt.
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING' || e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API + generated audio: network-first (always fresh online), but fall back to a
  // downloaded copy when offline. Only explicitly downloaded items are in a cache,
  // so non-downloaded requests just fail offline as before.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/audio/')) {
    e.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  // SPA navigations: network-first, fall back to the cached app shell offline.
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Static assets (hashed JS/CSS/images/fonts): cache-first, then fill the cache.
  e.respondWith(
    caches.match(request).then((hit) =>
      hit || fetch(request).then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      }).catch(() => hit)
    )
  );
});
