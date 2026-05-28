self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => e.respondWith(fetch(e.request)));

self.addEventListener('push', (event) => {
  if (!event.data) return;
  const { title, body, url } = event.data.json();
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      vibrate: [200, 100, 200],
      data: { url: url || '/admin?tab=historique' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/admin?tab=historique';
  // Store the target URL in cache — MobileApp reads it on mount and redirects
  event.waitUntil(
    caches.open('__notif_redirect__')
      .then(c => c.put('target', new Response(url)))
      .then(() => clients.openWindow('/mobile'))
  );
});
