// Service worker de Elite Independiente: abre la app aunque no haya internet.
// Primero intenta la red (así siempre se ve la última versión) y, si no hay
// conexión, usa la copia guardada. Los datos del club los guarda Firebase aparte:
// aquí solo se guardan los archivos de la app, nunca datos ni la sesión.
//
// Ojo: todas las apps de igaviria0001-ops.github.io comparten el mismo espacio de
// copias. Por eso esta solo borra SUS copias viejas (elite-sport-…) y se repara
// sola si otra app las borra.
const VERSION = 'elite-sport-4b5728476a';
const MINE = /^(elite-sport-|es-v\d)/;
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/main.js', 'js/version.js', 'js/state.js', 'js/views.js', 'js/actions.js', 'js/onboard.js', 'js/util.js', 'js/backend.js', 'js/config.js', 'js/local.js', 'js/vendor/firebase.js',
  'assets/escudo.jpg', 'assets/cabecera.jpg', 'assets/uniforme-rojo.jpg', 'assets/uniforme-negro.jpg', 'assets/icon-192.png', 'assets/favicon.png',
  'assets/fonts/barlow-condensed-latin-600-normal.woff2', 'assets/fonts/barlow-condensed-latin-700-normal.woff2', 'assets/fonts/barlow-condensed-latin-800-normal.woff2',
  'assets/fonts/barlow-latin-500-normal.woff2', 'assets/fonts/barlow-latin-600-normal.woff2', 'assets/fonts/barlow-latin-700-normal.woff2'
];
// Guarda los archivos uno por uno: si alguno falla, los demás quedan igual.
async function fill(fresh) {
  const c = await caches.open(VERSION);
  await Promise.all(SHELL.map(async u => {
    try { if (fresh || !(await c.match(u))) { const r = await fetch(u, { cache: 'no-cache' }); if (r.ok) await c.put(u, r); } } catch (e) {}
  }));
}
self.addEventListener('install', e => { e.waitUntil(fill(true).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => MINE.test(k) && k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// La app avisa al abrir: si otra app del mismo dominio borró la copia, se rehace.
self.addEventListener('message', e => { if (e.data === 'fill') e.waitUntil(fill(false)); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.endsWith('/version.json')) return; // consulta de versión: siempre directo a la red
  // cache: 'no-cache' pregunta siempre al servidor si hay versión nueva (si no la hay,
  // responde rápido sin volver a descargar), así una actualización se ve de inmediato.
  e.respondWith(
    fetch(r.url, { cache: 'no-cache', credentials: 'same-origin' }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(r, copy)); }
      return res;
    }).catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || (r.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
