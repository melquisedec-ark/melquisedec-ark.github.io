/* ═══════════════════════════════════════════
   Melquisedec — Service Worker (PWA)
   Cache-first para assets estáticos,
   network-first para todo lo demás.
   ═══════════════════════════════════════════ */

'use strict';

const CACHE = 'mq-app-v1';
const STATIC_ASSETS = [
  '/',
  '/css/style.css',
  '/js/main.js',
  '/manifest.json',
  '/assets/icons/favicon.png',
  '/assets/images/logo-mq.png',
  '/assets/images/og-image.png',
];

// ── Install: precargar assets estáticos ──
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

// ── Activate: limpiar cachés viejas ──
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  e.waitUntil(clients.claim());
});

// ── Fetch: cache-first para estáticos, network-first para el resto ──
self.addEventListener('fetch', (e) => {
  // Solo interceptar GET
  if (e.request.method !== 'GET') return;

  // No cachear llamadas a la API de GitHub
  if (e.request.url.includes('api.github.com')) {
    e.respondWith(fetch(e.request));
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => {
      // Cache hit → devolverlo
      if (cached) return cached;
      // No está en caché → fetch y cachear
      return fetch(e.request).then((res) => {
        // Solo cachear respuestas válidas del mismo origen
        if (res.ok && e.request.url.startsWith(self.location.origin)) {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(e.request, clone));
        }
        return res;
      });
    }),
  );
});
