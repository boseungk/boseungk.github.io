/* My Animal Room service worker. Generated: edit tools/templates/sw.js, never docs/sw.js (tools/sitebuild/sw.py).
   Cache-first for immutable same-origin files only: hashed names (<base>.<sha10>.<ext>) and ?v=<sha10> URLs. Pages,
   the feedback API, Turnstile, the stores, other origins, non-GET and Range requests are never touched. A response is
   stored only when its bytes hash to the sha10 in its URL. No precache, no offline page. Kill switch: ?sw=off. */
'use strict';
const CACHE = 'mar-immutable-v1';
const KEEP = '/assets/cache-keep.379f1ed316.json';
const MAX = 1600;
const HASHED = /\.([0-9a-f]{10})\.(?:webp|png|jpg|svg|otf|ttf|woff2|json)$/;
const VERSIONED = /[?&]v=([0-9a-f]{10})$/;

self.addEventListener('install', event => {
  try {
    // Chrome 123+: navigations go straight to the network without starting this worker.
    if (event.addRoutes) event.waitUntil(Promise.resolve(event.addRoutes({ condition: { requestMode: 'navigate' }, source: 'network' })).catch(() => {}));
  } catch (e) {}
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => event.waitUntil(activate()));

self.addEventListener('fetch', event => {
  const hash = immutable(event.request);
  if (hash) event.respondWith(serve(event, hash));
});

// The sha10 an eligible request's bytes must have, or '' to leave the request alone.
function immutable(request) {
  try {
    if (request.method !== 'GET' || request.mode === 'navigate' || request.headers.has('range')) return '';
    const url = new URL(request.url);
    if (url.origin !== self.location.origin || url.pathname.startsWith('/assets/cache-keep.')) return '';
    const match = HASHED.exec(url.pathname) || VERSIONED.exec(url.search);
    return match ? match[1] : '';
  } catch (e) {
    return '';
  }
}

async function serve(event, hash) {
  const request = event.request;
  const key = request.url.split('#')[0];
  try {
    const hit = await caches.match(key, { cacheName: CACHE, ignoreVary: true });
    if (hit) return hit;
  } catch (e) {}   // Cache Storage unavailable (quota, private mode): plain network
  const response = await fetch(request);
  if (response.status === 200 && response.type === 'basic' && !response.redirected) {
    try { event.waitUntil(store(key, response.clone(), response.clone(), hash)); } catch (e) {}
  }
  return response;
}

async function store(key, forHash, forCache, hash) {
  try {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', await forHash.arrayBuffer()));
    let hex = '';
    for (let i = 0; i < 5; i++) hex += digest[i].toString(16).padStart(2, '0');
    // Never keep bytes under a name they do not match. A deleted cache (?sw=off) stays deleted until the next
    // worker activates: only activate() creates it.
    if (hex !== hash || !(await caches.has(CACHE))) {
      if (forCache.body) forCache.body.cancel().catch(() => {});
      return;
    }
    const cache = await caches.open(CACHE);
    await cache.put(key, forCache);
    await trim();
  } catch (e) {}
}

// Over MAX: the oldest room files go first (a room is a few dozen files and loads again on demand), then the oldest
// of the rest, so the fonts, CSS and art every page uses stay. A burst of stores shares one pass (plus one more if
// stores arrived while it ran) instead of listing the cache once per file.
let trimming = null, trimAgain = false;
function trim() {
  if (trimming) { trimAgain = true; return trimming; }
  trimming = (async () => {
    do {
      trimAgain = false;
      if (!(await caches.has(CACHE))) return;   // ?sw=off deleted it: never re-create it here
      const cache = await caches.open(CACHE);
      const keys = await cache.keys();   // insertion order: the oldest first
      const over = keys.length - MAX;
      if (over <= 0) continue;
      const rooms = keys.filter(request => new URL(request.url).pathname.startsWith('/assets/rooms/'));
      const victims = rooms.slice(0, over);
      if (victims.length < over) {
        const chosen = new Set(victims);
        victims.push(...keys.filter(request => !chosen.has(request)).slice(0, over - victims.length));
      }
      await Promise.all(victims.map(request => cache.delete(request)));
    } while (trimAgain);
  })().catch(() => {}).finally(() => { trimming = null; if (trimAgain) trim(); });
  return trimming;
}

async function activate() {
  try {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('mar-') && name !== CACHE).map(name => caches.delete(name)));
  } catch (e) {}
  let cache = null;
  try { cache = await caches.open(CACHE); } catch (e) {}
  try {
    const response = await fetch(KEEP, { cache: 'no-store' });
    const list = response.ok ? await response.json() : null;
    if (cache && Array.isArray(list) && list.length) {   // no usable list: prune nothing
      const keep = new Set(list.map(url => new URL(url, self.location.origin).href));
      const stale = (await cache.keys()).filter(request => !keep.has(request.url.split('#')[0]));
      await Promise.all(stale.map(request => cache.delete(request)));
    }
  } catch (e) {}
  try { await self.clients.claim(); } catch (e) {}
}
