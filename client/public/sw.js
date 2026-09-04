/**
 * Antigravity Web Studio - Service Worker
 * PWA Offline Cache, Static Shell Precaching & Ergonomic API Handling
 */

const CACHE_VERSION = 'agy-v1.0.1';
const STATIC_CACHE_NAME = `antigravity-static-${CACHE_VERSION}`;
const API_CACHE_NAME = `antigravity-api-${CACHE_VERSION}`;

// Precache essential application shell files relative to service worker scope
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.svg',
  './icons/icon-512.svg'
];

// 1. Install Event - Precache App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE_NAME)
      .then((cache) => {
        // Use individual add with catch to prevent a single missing asset from blocking SW installation
        return Promise.allSettled(
          PRECACHE_ASSETS.map((asset) =>
            cache.add(asset).catch((err) => {
              console.warn(`[SW] Precache failed for ${asset}:`, err);
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// 2. Activate Event - Clean old caches & claim clients
self.addEventListener('activate', (event) => {
  const allowedCaches = [STATIC_CACHE_NAME, API_CACHE_NAME];

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (!allowedCaches.includes(cacheName)) {
              console.log(`[SW] Deleting obsolete cache: ${cacheName}`);
              return caches.delete(cacheName);
            }
            return null;
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Helper: Determine if request is an SSE stream
function isSSEStream(request, url) {
  const acceptHeader = request.headers.get('accept') || '';
  return (
    acceptHeader.includes('text/event-stream') ||
    url.pathname.includes('/events') ||
    url.pathname.includes('/stream')
  );
}

// Helper: Determine if request is a static asset
function isStaticAsset(request, url) {
  const staticExtensions = /\.(js|css|svg|png|jpg|jpeg|webp|gif|ico|woff|woff2|ttf|otf|eot)(\?.*)?$/i;
  const isExtensionMatch = staticExtensions.test(url.pathname);
  const isDestinationMatch = ['script', 'style', 'font', 'image'].includes(request.destination);
  return isExtensionMatch || isDestinationMatch;
}

// 3. Fetch Event - Intelligent Caching Strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore non-HTTP/HTTPS schemes (e.g. chrome-extension:, file:)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Bypass non-GET requests (mutations like POST, PUT, DELETE, PATCH must not be cached)
  if (request.method !== 'GET') {
    return;
  }

  // --- SSE Streams: Pure Network Pass-Through ---
  // Server-Sent Events must never be buffered or stored in CacheStorage
  if (isSSEStream(request, url)) {
    event.respondWith(fetch(request));
    return;
  }

  // --- API Endpoints: Network-First Strategy ---
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // Clone and cache successful GET responses
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(API_CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback: Check cache for previously cached API response
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              const modifiedHeaders = new Headers(cachedResponse.headers);
              modifiedHeaders.set('X-Antigravity-Offline', 'true');
              return new Response(cachedResponse.body, {
                status: cachedResponse.status,
                statusText: cachedResponse.statusText,
                headers: modifiedHeaders
              });
            }

            // Return standardized offline error payload
            return new Response(
              JSON.stringify({
                error: 'Network connection unavailable',
                offline: true,
                timestamp: Date.now()
              }),
              {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
              }
            );
          });
        })
    );
    return;
  }

  // --- Static Assets (Scripts, Styles, Fonts, Images): Cache-First Strategy ---
  if (isStaticAsset(request, url)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        // Fetch from network, cache dynamically, then return
        return fetch(request)
          .then((networkResponse) => {
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
              return networkResponse;
            }
            // Do NOT cache if response is HTML (e.g. SPA 404 fallback returning index.html for missing js/css)
            const contentType = networkResponse.headers.get('content-type') || '';
            if (contentType.includes('text/html') && !url.pathname.endsWith('.html')) {
              return networkResponse;
            }
            const responseToCache = networkResponse.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
            return networkResponse;
          })
          .catch((err) => {
            console.warn(`[SW] Failed fetching static asset ${url.pathname}:`, err);
            // Return empty response or propagate error
            throw err;
          });
      })
    );
    return;
  }

  // --- HTML Navigation Requests (SPA Route Fallback) ---
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request).catch(() => {
        // Offline fallback to app shell /index.html
        return caches.match('/index.html').then((shell) => {
          if (shell) return shell;
          return caches.match('/');
        });
      })
    );
    return;
  }

  // Default: Network with Cache Fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// 4. Message Event - Allow client to trigger skipWaiting or cache invalidation
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((keys) => {
      return Promise.all(keys.map((k) => caches.delete(k)));
    });
  }
});
