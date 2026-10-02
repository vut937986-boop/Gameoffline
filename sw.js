const CACHE_NAME = 'neon-brew-shell-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './js/config/constants.js',
  './js/state/initial-state.js',
  './css/app.css',
  './css/cyber-events.css',
  './css/game-themes.css',
  './css/responsive.css',
  './css/playful-cafe.css',
  './css/modern-cafe.css',
  './js/catalog.js',
  './js/event-rules.js',
  './js/i18n.js',
  './js/i18n/vi.js',
  './js/i18n/en.js',
  './js/core/helpers.js',
  './js/core/render.js',
  './js/core/tutorial.js',
  './js/save/migration.js',
  './js/save/save-manager.js',
  './js/app.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('neon-brew-') && key !== CACHE_NAME).map(key => caches.delete(key))
  )));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(fetch(request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
    }
    return response;
  }).catch(async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') return caches.match('./index.html');
    return Response.error();
  }));
});