/* Besidevalley offline shell cache. Remote GLB models are cached separately in IndexedDB. */
'use strict';
const CACHE_NAME = 'besidevalley-shell-v18';
const EXTERNAL_SCRIPTS = [
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js'
];

const SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/assets.js',
  './js/palette.js',
  './js/toon.js',
  './js/save.js',
  './js/icons.js',
  './js/ui.js',
  './js/legacy-world.js',
  './js/fx.js',
  './js/sky.js',
  './js/rig.js',
  './js/phys.js',
  './js/player.js',
  './js/input.js',
  './js/combat.js',
  './js/audio-fix.js',
  './js/enemies.js',
  './js/items.js',
  './js/inventory.js',
  './js/rooms.js',
  './js/dungeon.js',
  './js/boss.js',
  './js/minimap.js',
  './js/menu.js',
  './js/main.js'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(SHELL.map(async path => {
      try {
        const response = await fetch(path, { cache: 'reload' });
        if (response.ok) await cache.put(path, response);
      } catch (_) { /* A failed optional shell entry should not break installation. */ }
    }).concat(EXTERNAL_SCRIPTS.map(async url => {
      try {
        const request = new Request(url, { mode: 'cors', credentials: 'omit', cache: 'reload' });
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response);
      } catch (_) { /* Keep the app installable even if a CDN is temporarily down. */ }
    })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('besidevalley-shell-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

function cacheKey(requestUrl) {
  const url = new URL(requestUrl);
  const version = url.searchParams.get('v');
  url.hash = '';
  if (version) return url.origin + url.pathname + '?v=' + encodeURIComponent(version);
  url.search = '';
  return url.origin + url.pathname;
}

function fallbackCacheKey(requestUrl) {
  const url = new URL(requestUrl);
  url.search = '';
  url.hash = '';
  return url.origin + url.pathname;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    const key = cacheKey(request.url);
    const fallbackKey = fallbackCacheKey(request.url);
    const isNavigation = request.mode === 'navigate';
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      if (!isNavigation) {
        const cached = await cache.match(key);
        if (cached) return cached;
      }
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(key, response.clone());
          // Keep an unversioned copy for the precached shell and offline fallback.
          if (key !== fallbackKey) await cache.put(fallbackKey, response.clone());
        }
        return response;
      } catch (error) {
        const cached = await cache.match(key) || await cache.match(fallbackKey);
        if (cached) return cached;
        throw error;
      }
    })());
    return;
  }

  // CDN scripts are cached after the first successful online run; IndexedDB handles GLB files.
  if (request.destination === 'script' && (url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'cdn.jsdelivr.net')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) {
        event.waitUntil(fetch(request).then(response => {
          if (response && (response.ok || response.type === 'opaque')) return cache.put(request, response.clone());
        }).catch(() => {}));
        return cached;
      }
      const response = await fetch(request);
      if (response && (response.ok || response.type === 'opaque')) {
        try { await cache.put(request, response.clone()); } catch (_) {}
      }
      return response;
    })());
  }
});
