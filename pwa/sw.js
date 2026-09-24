// Service worker: ruan vetëm guaskën e aplikacionit (HTML, CSS, JS, ikona) që të hapet offline.
// Nuk ruan kurrë: kërkesa te serveri i llogarive, të dhëna të dekriptuara, apo diçka nga një origjinë tjetër.
// Të dhënat e përdoruesit nuk kalojnë kurrë nga këtu — ato rrinë në localStorage.
const VERSION = '__VERSION__';
const CACHE = `ajm-shell-${VERSION}`;
const SHELL = __SHELL__;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  // Nuk kalojmë vetë te versioni i ri: pret derisa përdoruesi të shtypë "Rifresko".
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('ajm-shell-') && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // Vetëm GET nga e njëjta origjinë. Supabase dhe çdo gjë tjetër shkon drejt e në rrjet, pa cache.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.headers.has('authorization')) return;

  if (request.mode === 'navigate') {
    // Faqja provohet së pari nga rrjeti (që të marrë versionin e ri); offline kthehet guaska.
    event.respondWith(fetch(request).catch(() => caches.match('/index.html')));
    return;
  }

  if (SHELL.includes(url.pathname)) {
    event.respondWith(caches.match(url.pathname).then(hit => hit || fetch(request)));
  }
});

// Web Push: titulli dhe teksti janë të përgjithshëm (pa vlera, pa shënime, pa tekst mesazhi).
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (error) { data = {}; }
  const title = typeof data.title === 'string' ? data.title.slice(0, 60) : 'A JE MIRË?';
  const body = typeof data.body === 'string' ? data.body.slice(0, 160) : '';
  event.waitUntil(self.registration.showNotification(title, {
    body, tag: typeof data.tag === 'string' ? data.tag : 'ajm', icon: '/icon-192.png', badge: '/icon-192.png',
    data: { url: typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/' }
  }));
});

// Klikimi hap aplikacionin — vetëm adresa brenda vetë aplikacionit.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(client => client.url.startsWith(self.location.origin));
    if (open) { open.navigate(target); return open.focus(); }
    return self.clients.openWindow(target);
  }));
});
