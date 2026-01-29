/* eslint-env serviceworker, es2021 */
/* jshint esversion: 10 */
/* global self, caches, clients, Response, URL */

/*
  Stratton Camera Service Worker (sw.js)

  Goals:
    • Remain safe under HTTPS (including Cloudflare Flexible)
    • Never cache redirects or HTML in place of JS/CSS
    • Only handle same-origin GET requests
    • Fast updates with network-first for HTML, SWR for CSS/JS
    • Bounded, cache-first for images/fonts

  Maintenance:
    • Bump SW_VERSION on each deploy
    • Keep PRECACHE_URLS lean
    • Purge old caches on activate
*/

////////////////////////////////////////////////////////////////////////////////
// VERSIONED CACHES
////////////////////////////////////////////////////////////////////////////////
const SW_VERSION = 'v12.3';                 // ← bump on every deploy
const PRECACHE   = `precache-${SW_VERSION}`;
const RUNTIME    = `runtime-${SW_VERSION}`;

// Minimal app shell (keep small)
const PRECACHE_URLS = [
  '/',                    // entry
  '/css/sc.css',          // BASE
  '/css/slideshow.css',   // shared component
  '/js/scripts.js',
  '/js/jq.min.js',
  '/site.webmanifest',
  '/favicon.ico'
];

////////////////////////////////////////////////////////////////////////////////
// INSTALL — Precache app shell & take control ASAP
////////////////////////////////////////////////////////////////////////////////
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

////////////////////////////////////////////////////////////////////////////////
// ACTIVATE — Clean old caches & claim clients
////////////////////////////////////////////////////////////////////////////////
self.addEventListener('activate', (event) => {
  const keep = new Set([PRECACHE, RUNTIME]);
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (keep.has(k) ? null : caches.delete(k))));
      await self.clients.claim();
    })()
  );
});

////////////////////////////////////////////////////////////////////////////////
// FETCH — Strategy matrix with strict guards
////////////////////////////////////////////////////////////////////////////////
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle same-origin GET requests
  if (req.method !== 'GET') return;

  // Chrome extension quirk: avoid errors on preloads
  if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 1) HTML/documents → Network-first
  if (req.destination === 'document' || req.mode === 'navigate') {
    event.respondWith(networkFirst(req));
    return;
  }

  // 2) CSS/JS → Stale-while-revalidate with type safety
  if (req.destination === 'style' || req.destination === 'script') {
    event.respondWith(staleWhileRevalidate(req, /*revalidate*/ true, /*strictType*/ true));
    return;
  }

  // 3) Images → Cache-first (bounded)
  if (req.destination === 'image') {
    event.respondWith(cacheFirstWithLimit(req, 200));
    return;
  }

  // 4) Fonts → Cache-first (smaller bound)
  if (req.destination === 'font') {
    event.respondWith(cacheFirstWithLimit(req, 50));
    return;
  }

  // 5) Everything else → conservative SWR
  event.respondWith(staleWhileRevalidate(req));
});

////////////////////////////////////////////////////////////////////////////////
// STRATEGIES
////////////////////////////////////////////////////////////////////////////////
async function networkFirst(request) {
  const cache = await caches.open(RUNTIME);
  try {
    const res = await fetch(request, { cache: 'no-store', redirect: 'follow' });
    if (isGoodResponse(res, request)) {
      cache.put(request, res.clone());
    }
    return res;
  } catch (e) {
    const cached = await cache.match(request);
    return cached || offlineFallback();
  }
}

async function staleWhileRevalidate(request, revalidate = false, strictType = false) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(request);

  const fetchOpts = {
    redirect: 'follow',
    cache: revalidate ? 'no-cache' : 'default'
  };

  const netPromise = fetch(request, fetchOpts).then((res) => {
    if (isGoodResponse(res, request, strictType)) {
      cache.put(request, res.clone());
    }
    return res;
  }).catch(() => null);

  return cached || netPromise || offlineFallback();
}

async function cacheFirstWithLimit(request, maxEntries = 300) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(request);

  if (cached) {
    // Background refresh (don’t block)
    fetch(request, { redirect: 'follow' })
      .then((res) => {
        if (isGoodResponse(res, request)) {
          cache.put(request, res.clone());
          trimCache(cache, maxEntries);
        }
      })
      .catch(() => {});
    return cached;
  }

  try {
    const res = await fetch(request, { redirect: 'follow' });
    if (isGoodResponse(res, request)) {
      cache.put(request, res.clone());
      trimCache(cache, maxEntries);
    }
    return res;
  } catch {
    return offlineFallback();
  }
}

////////////////////////////////////////////////////////////////////////////////
// HELPERS
////////////////////////////////////////////////////////////////////////////////
function isGoodResponse(res, req, strictType = false) {
  if (!res) return false;
  // Must be a successful, same-origin (basic) response and NOT a redirect
  if (!res.ok || res.type !== 'basic' || res.redirected) return false;

  if (!strictType) return true;

  // When strictType is on (for CSS/JS), verify content-type matches the request
  const dest = req && req.destination;
  const ct = (res.headers.get('content-type') || '').toLowerCase();

  if (dest === 'script') return ct.includes('javascript');
  if (dest === 'style')  return ct.includes('css');
  if (dest === 'image')  return ct.startsWith('image/');
  if (dest === 'document') return ct.includes('html');

  return true; // for other asset types
}

function offlineFallback() {
  // Tiny empty fallback to avoid throwing; customize if desired.
  return new Response('', { status: 504, statusText: 'Offline' });
}

async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();
  const excess = keys.length - maxEntries;
  if (excess > 0) {
    for (let i = 0; i < excess; i++) {
      await cache.delete(keys[i]);
    }
  }
}

// Allow page to request immediate activation
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});