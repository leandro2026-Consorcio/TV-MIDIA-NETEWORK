const CACHE_NAME = 'mpm-tv-shell-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith('mpm-tv-shell-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

// O Player depende de programação e URLs assinadas atuais. A PWA mantém a
// experiência de app/tela cheia, mas continua network-first e não reproduz
// mídia vencida de um cache antigo.
self.addEventListener('fetch', (event) => {
  if (event.request.method === 'GET') {
    event.respondWith(fetch(event.request));
  }
});
