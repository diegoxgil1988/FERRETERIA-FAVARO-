const CACHE_NAME = 'favaro-v3';
const APP_SHELL = ['/'];

// Al instalar: cachear el HTML principal
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(APP_SHELL);
    }).then(() => self.skipWaiting())
  );
});

// Al activar: limpiar caches viejas
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

// Fetch: network-first para Supabase, cache-first para el app shell
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Supabase requests: network only (no cachear datos sensibles)
  if (url.hostname.includes('supabase.co')) {
    return; // dejar pasar normalmente
  }

  // CDN scripts (xlsx, supabase-js): cache-first
  if (url.hostname.includes('cdnjs.cloudflare.com') ||
      url.hostname.includes('jsdelivr.net')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(resp => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return resp;
        });
      })
    );
    return;
  }

  // App shell (index.html): network-first, fallback a cache
  if (e.request.mode === 'navigate' || url.pathname === '/') {
    e.respondWith(
      fetch(e.request)
        .then(resp => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return resp;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Íconos y manifest: cache-first
  if (url.pathname.includes('icon') || url.pathname.includes('manifest')) {
    e.respondWith(
      caches.match(e.request).then(c => c || fetch(e.request))
    );
  }
});
