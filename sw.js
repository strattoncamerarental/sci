/* eslint-env serviceworker, es2021 */
/* global self, caches, clients, Response, URL */

/*
  Stratton Camera Service Worker (sw.js)

  Purpose (2026):
  • Fast repeat navigation for a large static catalog
  • Safe caching under HTTPS + Cloudflare FULL
  • Never cache redirects or wrong content-types
  • Predictable updates (no stale CSS/JS surprises)
  • Bounded runtime caches (no storage creep)

  Update policy:
  • Bump SW_VERSION on every deploy
*/

////////////////////////////////////////////////////////////////////////////////
// VERSIONED CACHES
////////////////////////////////////////////////////////////////////////////////
const SW_VERSION = 'v13.1';

const PRECACHE = `precache-${SW_VERSION}`;
const RUNTIME  = `runtime-${SW_VERSION}`;

////////////////////////////////////////////////////////////////////////////////
// PRECACHE (static, truly stable assets only)
////////////////////////////////////////////////////////////////////////////////
const PRECACHE_URLS = [
  '/css/sc.css',
  '/css/slideshow.css',
  '/js/scripts.js',
  '/js/jq.min.js',
  '/site.webmanifest',
  '/favicon.ico'
];

////////////////////////////////////////////////////////////////////////////////
// INSTALL — Precache + activate immediately
////////////////////////////////////////////////////////////////////////////////
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

////////////////////////////////////////////////////////////////////////////////
// ACTIVATE — Remove old caches + claim clients
////////////////////////////////////////////////////////////////////////////////
self.addEventListener('activate', (event) => {
  const keep = new Set([PRECACHE, RUNTIME]);

  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => (keep.has(key) ? null : caches.delete(key)))
      );
      await self.clients.claim();
    })()
  );
});

////////////////////////////////////////////////////////////////////////////////
// FETCH — Routing + strategies
////////////////////////////////////////////////////////////////////////////////
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only same-origin GET requests
  if (req.method !== 'GET') return;

  // Chrome preload quirk
  if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Documents (HTML) → network-first
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(networkFirst(req));
    return;
  }

  // CSS / JS → stale-while-revalidate (strict)
  if (req.destination === 'style' || req.destination === 'script') {
    event.respondWith(staleWhileRevalidate(req, event, true));
    return;
  }

  // Images → cache-first (bounded)
  if (req.destination === 'image') {
    event.respondWith(cacheFirst(req, event, 200));
    return;
  }

  // Fonts → cache-first (smaller bound)
  if (req.destination === 'font') {
    event.respondWith(cacheFirst(req, event, 50));
    return;
  }

  // Everything else → SWR (non-strict)
  event.respondWith(staleWhileRevalidate(req, event));
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
  } catch {
    const cached = await cache.match(request);
    return cached || offlineDocument();
  }
}

async function staleWhileRevalidate(request, event, strictType = false) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(request);

  const updatePromise = fetch(request, { redirect: 'follow' })
    .then((res) => {
      if (isGoodResponse(res, request, strictType)) {
        cache.put(request, res.clone());
      }
      return res;
    })
    .catch(() => null);

  // Guarantee background update completes
  event.waitUntil(updatePromise);

  if (cached) return cached;

  const res = await updatePromise;
  return res || offlineFallback();
}

async function cacheFirst(request, event, maxEntries) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(request);

  if (cached) {
    const refresh = fetch(request, { redirect: 'follow' })
      .then((res) => {
        if (isGoodResponse(res, request)) {
          cache.put(request, res.clone());
          trimCache(cache, maxEntries);
        }
      })
      .catch(() => {});

    event.waitUntil(refresh);
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
  if (!res.ok) return false;
  if (res.type !== 'basic') return false;
  if (res.redirected) return false;

  if (!strictType) return true;

  const dest = req.destination;
  const ct = (res.headers.get('content-type') || '').toLowerCase();

  if (dest === 'script')   return ct.includes('javascript');
  if (dest === 'style')    return ct.includes('css');
  if (dest === 'image')    return ct.startsWith('image/');
  if (dest === 'document') return ct.includes('html');

  return true;
}

function offlineDocument() {
  return new Response(
    '<!doctype html><title>Offline</title>' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<h1>Offline</h1><p>This page isn’t available without a connection.</p>',
    { headers: { 'content-type': 'text/html; charset=utf-8' }, status: 503 }
  );
}

function offlineFallback() {
  return new Response('', { status: 504, statusText: 'Offline' });
}

async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();
  const excess = keys.length - maxEntries;
  for (let i = 0; i < excess; i++) {
    await cache.delete(keys[i]);
  }
}

////////////////////////////////////////////////////////////////////////////////
// MESSAGES
////////////////////////////////////////////////////////////////////////////////
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});