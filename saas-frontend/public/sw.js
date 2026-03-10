/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */

/**
 * CyberSec Pro — Lightweight Service Worker
 * Caches the app shell for instant re-loads and basic offline support.
 * Does NOT cache API responses (React Query handles that).
 */

const CACHE_NAME = 'cybersec-v19';
const SHELL_ASSETS = [
  '/dashboard/',
  '/dashboard/index.html',
];

// Install: pre-cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

// Activate: remove old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for navigations, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, API calls, and external resources
  if (request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.origin !== self.location.origin) return;

  // Navigation requests: network-first with shell fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/dashboard/index.html'))
    );
    return;
  }

  // Static assets (JS/CSS): stale-while-revalidate
  if (url.pathname.match(/\.(js|css|woff2?|svg|png|ico)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }
});
