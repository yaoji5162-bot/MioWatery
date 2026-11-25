/* 小手机 Service Worker：系统通知；同源 GET 网络优先（成功写入缓存，失败回退缓存）。在线时仍取最新页面。 */
const CACHE = 'mio-pwa-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
  await self.clients.claim();
})()));

// 同源 GET：先走网络并缓存成功响应；网络失败时回退缓存
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req);
      if (res && res.status === 200 && res.type === 'basic') {
        try {
          const copy = res.clone();
          const stored = res.redirected
            ? new Response(copy.body, { status: res.status, statusText: res.statusText, headers: new Headers(res.headers) })
            : copy;
          await cache.put(req, stored);
        } catch (_) {}
      }
      return res;
    } catch (_) {
      const hit = await cache.match(req);
      if (hit) return hit;
      throw _;
    }
  })());
});

// 点通知：回到小手机，并打开对应聊天
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const pid = (e.notification.data || {}).pid || '';
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) {
      if ('focus' in c) { await c.focus(); c.postMessage({ type: 'open-chat', pid }); return; }
    }
    if (self.clients.openWindow) await self.clients.openWindow('./' + (pid ? '?openChat=' + encodeURIComponent(pid) : ''));
  })());
});

// 预留：以后做服务器 Web Push 时，推送内容在这里显示
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) {}
  e.waitUntil(self.registration.showNotification(d.title || 'Mio水汪汪', {
    body: d.body || '', tag: d.tag || 'push', data: d.data || {}, icon: d.icon, renotify: true
  }));
});
