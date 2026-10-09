const CACHE = 'lm-v2';
// При установке кэшируем саму страницу
self.addEventListener('install', e => {
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});
// Стратегия: сначала сеть, при ошибке — кэш
self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET') return;
  e.respondWith(
    // Файлы приложения всегда сверяем с сервером (ETag) — после обновления на GitHub не нужно ждать сброса кэша
    fetch(e.request, new URL(e.request.url).origin === self.location.origin ? { cache: 'no-cache' } : undefined)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
