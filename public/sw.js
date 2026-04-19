/* Fixkosten Tracker service worker: supports notification click + future push */
const CACHE = 'fixkosten-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/fixkostentracker/';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) {
      if ('focus' in client) {
        try { await client.focus(); } catch {}
        if ('navigate' in client) { try { await client.navigate(url); } catch {} }
        return;
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: 'Fixkosten', body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'Fixkosten Tracker';
  const opts = {
    body: data.body || '',
    icon: '/fixkostentracker/icon-192x192.png',
    badge: '/fixkostentracker/icon-192x192.png',
    tag: data.tag,
    data: { url: data.url || '/fixkostentracker/' },
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('message', (event) => {
  const msg = event.data || {};
  if (msg.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag, url } = msg;
    self.registration.showNotification(title || 'Fixkosten Tracker', {
      body: body || '',
      icon: '/fixkostentracker/icon-192x192.png',
      badge: '/fixkostentracker/icon-192x192.png',
      tag,
      data: { url: url || '/fixkostentracker/' },
    });
  }
});
