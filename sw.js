// Angora Riders - Service Worker (uygulama kabuğunu önbelleğe alır)
const VERSION = 'ar-v1';
const SHELL = [
  '/', '/index.html', '/css/app.css', '/manifest.webmanifest',
  '/js/app.js', '/js/core.js', '/js/config.js', '/js/ui.js', '/js/stats.js',
  '/js/views/dashboard.js', '/js/views/members.js', '/js/views/member.js', '/js/views/calendar.js',
  '/js/views/event.js', '/js/views/reports.js', '/js/views/users.js', '/js/views/settings.js', '/js/views/account.js',
  '/assets/logo.png', '/assets/icon-192.png', '/assets/favicon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Kütüphane & yazı tipleri: önce önbellek
  if (/cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com/.test(url.host)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res;
    })));
    return;
  }
  if (url.origin !== location.origin) return;   // Supabase API vb. — dokunma

  // Uygulama dosyaları: önce ağ (güncel kalsın), çevrimdışıysa önbellek
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then(hit => hit || caches.match('/index.html'))));
});
