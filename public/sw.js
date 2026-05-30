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

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // App already open: send a message to navigate without reloading
      const mobileClient = clientList.find((c) => new URL(c.url).pathname === '/mobile');
      if (mobileClient) {
        mobileClient.postMessage({ type: 'NAVIGATE', url });
        return mobileClient.focus();
      }
      // App not open: store URL in cache and open
      return caches.open('__notif_redirect__')
        .then((c) => c.put('target', new Response(url)))
        .then(() => clients.openWindow('/mobile'));
    })
  );
});
