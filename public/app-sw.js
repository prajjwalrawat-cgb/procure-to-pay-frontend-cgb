/* eslint-env serviceworker */
/* global self, caches, fetch */

/**
 * ProcureFlow app service worker — the installable shell for the buyer app and
 * the vendor portal. The warehouse scanner has its own worker (sw.js, scope
 * /scan); a narrower scope wins, so /scan pages are never handled here.
 *
 * Deliberately small, and hand-written for the same reason as sw.js: the rules
 * are the whole requirement and read better than a generated Workbox config.
 *
 *  - The API is never cached. Approvals, invoice status and payment state must
 *    not be shown stale, and they are per-user data.
 *  - Pages are never cached either — only the static offline page, which is
 *    served when a navigation fails. A cached page could outlive the session
 *    that rendered it.
 *  - Hashed build output and icons are cache-first: their URLs change whenever
 *    their content does.
 *
 * Registered only in production builds (see components/pwa-register.tsx): in
 * `next dev` the chunk URLs are stable while their content changes, so
 * cache-first would serve stale code.
 */

const VERSION = 'app-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const OFFLINE_URL = '/offline.html';

const PRECACHE = [
  OFFLINE_URL,
  '/icons/app-192.png',
  '/icons/app-512.png',
  '/icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // One at a time rather than addAll, so a single miss during a deploy does
      // not leave the worker uninstalled.
      await Promise.all(
        PRECACHE.map(async (url) => {
          try {
            await cache.add(new Request(url, { cache: 'reload' }));
          } catch {
            /* retried by runtime caching */
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Only this worker's own caches — the scanner's `scan-*` caches belong
      // to sw.js and must survive.
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith('app-') && !n.startsWith(VERSION))
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkOrOffline(request));
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) void cache.put(request, response.clone());
  return response;
}

async function networkOrOffline(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    return (
      (await cache.match(OFFLINE_URL)) ??
      new Response('You are offline.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    );
  }
}
