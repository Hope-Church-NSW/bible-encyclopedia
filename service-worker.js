const CACHE_NAME = 'bible-encyclopedia-v18';
const CORE_ASSETS = [
  './',
  'index.html',
  'studies.html',
  'bible.html',
  'assets/project-header-runtime.css',
  'assets/project-header.css',
  'assets/project-header-runtime.js',
  'assets/project-translations-en.json',
  'assets/logo.png',
  'assets/app-icons/icon-192.png',
  'assets/app-icons/icon-512.png',
  'assets/app-icons/maskable-192.png',
  'assets/app-icons/maskable-512.png',
  'assets/app-icons/apple-touch-icon-180.png',
  'assets/app-icons/favicon-48.png',
  'manifest.webmanifest',
  'offline-assets.json'
];
const scopedUrl = (asset) => new URL(asset, self.registration.scope).href;

function safeAssetUrl(asset) {
  if (typeof asset !== 'string' || !asset || asset.includes('\\')) return null;
  const url = new URL(asset, self.registration.scope);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname) || url.search || url.hash) return null;
  return url.href;
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS.map(scopedUrl))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((names) => Promise.all(names
      .filter((name) => name.startsWith('bible-encyclopedia-') && name !== CACHE_NAME)
      .map((name) => caches.delete(name)))),
    self.clients.claim()
  ]));
});

async function cachePublishedSite() {
  const cache = await caches.open(CACHE_NAME);
  const response = await fetch(scopedUrl('offline-assets.json'), { cache: 'no-store' });
  if (!response.ok) throw new Error(`Offline asset list returned ${response.status}`);
  const { version, assets } = await response.json();
  if (typeof version !== 'string' || !/^[a-f0-9]{16}$/.test(version)) throw new Error('Offline asset version is invalid');
  const readyMarker = scopedUrl(`__offline-ready-${version}`);
  if (await cache.match(readyMarker)) return;
  if (!Array.isArray(assets)) throw new Error('Offline asset list is invalid');
  const urls = assets.map(safeAssetUrl);
  if (urls.some((url) => !url)) throw new Error('Offline asset list contains an unsafe path');
  const failures = [];
  for (let index = 0; index < urls.length; index += 12) {
    await Promise.all(urls.slice(index, index + 12).map(async (url) => {
      try {
        const assetResponse = await fetch(url, { cache: 'no-store' });
        if (!assetResponse.ok) throw new Error(`HTTP ${assetResponse.status}`);
        await cache.put(url, assetResponse);
      } catch (_) {
        failures.push(url);
      }
    }));
  }
  if (failures.length) throw new Error(`Unable to cache ${failures.length} offline assets`);
  await cache.put(readyMarker, new Response(new Date().toISOString()));
}

self.addEventListener('message', (event) => {
  if (event.data === 'CACHE_PUBLISHED_SITE') event.waitUntil(cachePublishedSite());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const requiresFreshCopy = event.request.mode === 'navigate'
      || url.pathname.endsWith('/assets/project-header-runtime.js')
      || url.pathname.endsWith('/assets/project-header-runtime.css')
      || url.pathname.endsWith('/encyclopedia_en.json')
      || url.pathname.endsWith('/offline-assets.json');

    if (requiresFreshCopy) {
      try {
        const response = await fetch(event.request, { cache: 'no-store' });
        if (response.ok) await cache.put(event.request, response.clone());
        return response;
      } catch (_) {
        return (await cache.match(event.request, { ignoreSearch: true }))
          || (event.request.mode === 'navigate' ? cache.match(scopedUrl('index.html')) : undefined)
          || Response.error();
      }
    }

    const cached = await cache.match(event.request);
    if (cached) {
      event.waitUntil(fetch(event.request).then((response) => {
        if (response.ok) return cache.put(event.request, response);
      }).catch(() => {}));
      return cached;
    }
    try {
      const response = await fetch(event.request);
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    } catch (_) {
      return (await cache.match(event.request, { ignoreSearch: true }))
        || (event.request.mode === 'navigate' ? cache.match(scopedUrl('index.html')) : undefined)
        || Response.error();
    }
  })());
});