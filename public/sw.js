/**
 * AforAudience service worker.
 *
 * Written by hand rather than pulled in via workbox / serwist / next-pwa
 * because the caching surface is small and the failure modes of an SW
 * are subtle enough that a ~150-line file we can read end-to-end beats
 * a library we can't. Bump CACHE_VERSION whenever cached routes or the
 * precache list change — the version string is the *only* thing that
 * expires old caches, since browsers don't invalidate SW caches on
 * deploy automatically.
 *
 * Strategies:
 *   - Precache the app shell (offline fallback + icons + manifest) on
 *     install, so a first-run install can go offline immediately after
 *     the initial visit finishes loading.
 *   - Navigation requests (top-level HTML): network-first, fall back to
 *     cache, fall back to /offline.html. This makes the app resilient to
 *     patchy signal (which is exactly the situation at a venue door)
 *     without ever serving stale HTML to a healthy connection.
 *   - Same-origin /_next/static/**: cache-first. These filenames are
 *     content-hashed so they're safe to cache indefinitely — a new deploy
 *     produces new filenames, and Next's own cache-control headers agree.
 *   - Same-origin /_next/image/**: stale-while-revalidate. Not hashed,
 *     but repeat requests are dominant and freshness isn't critical.
 *   - Everything under /api/**: network-only, never cached. Authenticated
 *     JSON must not be served from a shared cache surface.
 *   - Cross-origin: pass through untouched. Not our problem to cache.
 */

const CACHE_VERSION = 'v1-2026-07-14';
const PRECACHE = `afora-precache-${CACHE_VERSION}`;
const RUNTIME = `afora-runtime-${CACHE_VERSION}`;

// The bare minimum needed for the offline shell to render.
const PRECACHE_URLS = [
  '/offline.html',
  '/manifest.webmanifest', // Next's App Router serves manifest.ts at this path
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      // Use individual add() calls so a single 404 doesn't fail the
      // whole install — the SW should be installable even if one
      // precache asset is missing (e.g. during a partial deploy).
      await Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[sw] precache failed for', url, err);
          })
        )
      );
      // Take over immediately on first install so subsequent navigations
      // are served through the SW without requiring a full reload.
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Clean up caches from previous versions. Keeps the origin under
      // the browser's storage quota over time.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith('afora-') && !k.endsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Only handle same-origin requests. Cross-origin (analytics, Razorpay
  // checkout iframe, Google Fonts if any) passes through untouched.
  if (url.origin !== self.location.origin) return;

  // Never cache API responses. Auth-sensitive JSON must always hit
  // the network so a shared cache never leaks another user's data.
  if (url.pathname.startsWith('/api/')) return;

  // Navigation requests: network-first with cache and offline fallbacks.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  // Content-hashed static assets: cache-first, indefinitely.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, RUNTIME));
    return;
  }

  // Next optimized images: stale-while-revalidate.
  if (url.pathname.startsWith('/_next/image')) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME));
    return;
  }

  // Everything else same-origin (icons, robots.txt, sitemap.xml, etc):
  // stale-while-revalidate is a safe default.
  event.respondWith(staleWhileRevalidate(request, RUNTIME));
});

/**
 * Network-first for HTML. If the network responds, cache the result and
 * return it. If the network fails and we have a cached copy, return that.
 * Else return the offline shell.
 */
async function networkFirstWithOfflineFallback(request) {
  const cache = await caches.open(RUNTIME);
  try {
    const response = await fetch(request);
    // Only cache successful, basic-type responses. Don't cache errors
    // or opaque responses that we can't safely serve later.
    if (response && response.ok && response.type === 'basic') {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    const offline = await caches.match('/offline.html');
    if (offline) return offline;
    // Last resort — synthetic 503. Should be rare.
    return new Response('Offline and no cached copy available.', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    cache.put(request, response.clone()).catch(() => {});
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkFetch = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => cached);
  return cached || networkFetch;
}

// Allow the app to trigger an immediate SW takeover after a deploy —
// the client can postMessage({ type: 'SKIP_WAITING' }) when the user
// clicks a "New version available, reload" prompt (not built yet, but
// the plumbing is here for when it is).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Web Push. Payload shape is { title, body, url } - see src/lib/push.ts,
// which is the only place that sends notifications, so this stays in
// sync with that file's PushPayload type by convention (no shared import
// possible across the SW/app boundary without a build step for this file).
self.addEventListener('push', (event) => {
  let data = { title: 'AforAudience', body: 'You have a new notification.', url: '/' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (err) {
    console.warn('[sw] push event had non-JSON payload', err);
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      data: { url: data.url || '/' },
    })
  );
});

// Focus an already-open tab on the target URL if one exists, otherwise
// open a new one. Standard pattern - without it, clicking a notification
// just does nothing.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientsList) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin) {
          await client.focus();
          if ('navigate' in client) await client.navigate(targetUrl);
          return;
        }
      }
      await self.clients.openWindow(targetUrl);
    })()
  );
});
