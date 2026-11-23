// Service worker de Elite Sport: abre la app aunque no haya internet.
// Primero intenta la red (así siempre se ve la última versión) y, si no hay
// conexión, usa la copia guardada. Los datos del club los guarda Firebase aparte.
const VERSION = 'es-v4';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/main.js', 'js/state.js', 'js/views.js', 'js/actions.js', 'js/onboard.js', 'js/util.js', 'js/backend.js', 'js/config.js', 'js/local.js', 'js/vendor/firebase.js',
  'assets/escudo.jpg', 'assets/cabecera.jpg', 'assets/uniforme-rojo.jpg', 'assets/uniforme-negro.jpg', 'assets/icon-192.png', 'assets/favicon.png',
  'assets/fonts/barlow-condensed-latin-600-normal.woff2', 'assets/fonts/barlow-condensed-latin-700-normal.woff2', 'assets/fonts/barlow-condensed-latin-800-normal.woff2',
  'assets/fonts/barlow-latin-500-normal.woff2', 'assets/fonts/barlow-latin-600-normal.woff2', 'assets/fonts/barlow-latin-700-normal.woff2'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(
    fetch(r).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(r, copy)); }
      return res;
    }).catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || (r.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
