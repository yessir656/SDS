/* SDS-CHEM Service Worker
 * ------------------------
 * Vanilla service worker (no Workbox, no bundler) for the SDS-CHEM PWA.
 *
 * Strategies:
 *   - Precache the app shell on install.
 *   - Navigation requests (HTML): network-first, fall back to cache (and
 *     finally to the cached "/" app shell for offline SPA navigation).
 *   - Static assets (JS, CSS, images, fonts): stale-while-revalidate.
 *   - Everything else (same-origin GET): try network, fall back to cache.
 *
 * Versioning: bump CACHE_VERSION to invalidate old caches on deploy.
 */

const CACHE_VERSION = 'sds-chem-v1';

// App shell URLs precached on install. Keep this list small and stable.
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon.svg',
];

// File extensions treated as static assets for stale-while-revalidate.
const STATIC_ASSET_PATTERN =
  /\.(?:js|css|png|jpg|jpeg|gif|webp|avif|svg|ico|woff|woff2|ttf|eot|otf)$/i;

/* ------------------------------------------------------------------ */
/* Install — precache the app shell                                    */
/* ------------------------------------------------------------------ */
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      // addAll is atomic: if any URL fails, none are cached.
      // We use individual put() with fetch fallback so a single missing
      // asset (e.g. an icon not yet present in dev) doesn't break install.
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            const res = await fetch(url, { cache: 'reload' });
            if (res && (res.ok || res.type === 'opaque')) {
              await cache.put(url, res.clone());
            }
          } catch (err) {
            console.warn('[sw] precache miss for', url, err);
          }
        })
      );
    })()
  );
  // Take over from the previous SW as soon as possible.
  self.skipWaiting();
});

/* ------------------------------------------------------------------ */
/* Activate — clean up old caches and claim clients                    */
/* ------------------------------------------------------------------ */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => {
            console.log('[sw] deleting old cache', key);
            return caches.delete(key);
          })
      );
      // Take control of all open clients immediately.
      await self.clients.claim();
    })()
  );
});

/* ------------------------------------------------------------------ */
/* Message — allow the page to trigger SKIP_WAITING                    */
/* ------------------------------------------------------------------ */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* ------------------------------------------------------------------ */
/* Fetch — apply caching strategies                                    */
/* ------------------------------------------------------------------ */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET; let the browser handle POST/PUT/etc.
  if (request.method !== 'GET') return;

  // Only handle same-origin requests; let cross-origin pass through.
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 1) Navigation requests (HTML pages) — network-first.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // 2) Static assets (JS, CSS, images, fonts) — stale-while-revalidate.
  const isStaticAsset =
    STATIC_ASSET_PATTERN.test(url.pathname) ||
    ['style', 'script', 'image', 'font'].includes(request.destination);

  if (isStaticAsset) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // 3) Default — network, fall back to cache.
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

/* ------------------------------------------------------------------ */
/* Strategy: network-first for navigations                             */
/* ------------------------------------------------------------------ */
async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const networkResponse = await fetch(request);
    // Cache a copy of successfully fetched HTML for offline use.
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    // Offline: try the exact URL first, then fall back to the app shell.
    const cached = await caches.match(request);
    if (cached) return cached;
    const fallback = await caches.match('/');
    if (fallback) return fallback;
    // Nothing cached — surface the network error.
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/* Strategy: stale-while-revalidate for static assets                  */
/* ------------------------------------------------------------------ */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((networkResponse) => {
      // Only cache successful, same-origin (basic/opaque) responses.
      if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch((err) => {
      // If we have a cached copy, swallow the network error;
      // otherwise rethrow so the request fails loudly.
      if (cached) return cached;
      throw err;
    });

  // Return cached immediately if available; otherwise wait for network.
  return cached || networkPromise;
}
