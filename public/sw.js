// App service worker (offline shell). Bump the version when cached files such as icons change.
const CACHE_NAME = 'building-mistry-v6';

const STATIC_ASSETS = [
  './',
  './index.html',
  './floor-planner.html',
  './manifest.json',
  './favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable.png',
  './icons/icon.svg'
];

/**
 * The app's own scripts and styles named in a page (Vite gives them hashed names), so the app can
 * start offline even when the very first visit is the last one made online.
 */
function shellAssetUrls(html) {
  const urls = new Set();
  const re = /(?:src|href)="([^"]+\.(?:js|css))"/g;
  let m;
  while ((m = re.exec(html))) {
    try {
      const u = new URL(m[1], self.registration.scope);
      if (u.origin === self.location.origin) urls.add(u.href);
    } catch { /* not a URL */ }
  }
  return [...urls];
}

function cacheShellAssets(cache, html) {
  return Promise.all(shellAssetUrls(html).map(url => cache.add(url).catch(() => undefined)));
}

// Install Event: Pre-cache static shell assets, then the scripts and styles the app page loads
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS)
        .then(() => cache.match('./index.html'))
        .then(page => (page ? page.text().then(html => cacheShellAssets(cache, html)) : undefined)))
      .then(() => self.skipWaiting())
  );
});

// Activate Event: Cleanup stale caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Safe Offline Caching
self.addEventListener('fetch', event => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Do not intercept Chrome extension or unsupported schemes
  if (!url.protocol.startsWith('http')) return;

  // Strategy for Navigation (HTML page loads)
  if (request.mode === 'navigate') {
    // The Floor Planner is its own page, opened in a frame. It keeps its own offline copy so
    // it never replaces the app's.
    const isPlanner = url.pathname.endsWith('/floor-planner.html');
    const pageKey = isPlanner ? './floor-planner.html' : './';
    event.respondWith(
      fetch(request)
        .then(response => {
          // Keep the offline copy of the page current. Without this the app shell cached at
          // install time is served forever when offline, even after the app has been updated.
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            const forAssets = isPlanner ? null : response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(pageKey, copy);
              // An updated app has new file names: keep its scripts and styles for offline starts too.
              if (forAssets) forAssets.text().then(html => cacheShellAssets(cache, html)).catch(() => undefined);
            });
          }
          return response;
        })
        .catch(() =>
          isPlanner
            ? caches.match('./floor-planner.html', { ignoreSearch: true })
            : caches.match('./').then(cached => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  // Strategy for Google Fonts & External Styles
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Stale-While-Revalidate for app assets (JS, CSS, images, icons)
  event.respondWith(
    caches.match(request).then(cachedResponse => {
      const fetchPromise = fetch(request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
