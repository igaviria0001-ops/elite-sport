// Arranque de Elite Independiente: sesión, datos en vivo y dibujo de la pantalla.
import * as B from './backend.js';
import { D, U, R, C, cats, watchCore, watchRole, restoreHost, coreReady, onRedraw, syncSubs } from './state.js';
import { VERSION } from './version.js';
import { OB } from './onboard.js';
import { gateHead, vBoot, vOnboard, vInicio, vCats, vCat, vPartidos, vEntreno, vLista, vPagos, vPersonas, headerRole, headerMe, navHtml } from './views.js';
import { bindActions, hydrate, sheetRefresh } from './actions.js';
import { toast, LS, esc } from './util.js';
window.__esBooted = true;

const $ = s => document.querySelector(s);
let st = B.status(), rq = 0;

function render() { if (!rq) rq = requestAnimationFrame(() => { rq = 0; draw(); }); }
bindActions(render);
onRedraw(render);

// Guarda lo que se está escribiendo para que un cambio que llegue en vivo no lo borre.
function grabForm(root) {
  const keep = {};
  root.querySelectorAll('[data-keep][id]').forEach(e => { keep[e.id] = e.value; });
  const a = document.activeElement;
  const focus = a && a.id && root.contains(a) ? { id: a.id, s: a.selectionStart, e: a.selectionEnd } : null;
  return { keep, focus };
}
function putForm(root, f) {
  for (const id in f.keep) { const e = root.querySelector('#' + CSS.escape(id)); if (e && e.dataset.keep !== undefined) e.value = f.keep[id]; }
  if (f.focus) { const e = root.querySelector('#' + CSS.escape(f.focus.id)); if (e) { e.focus({ preventScroll: true }); try { if (f.focus.s != null) e.setSelectionRange(f.focus.s, f.focus.e); } catch (x) {} } }
}

function view() {
  if (R.boot !== 'ready') return vBoot();
  if (!R.meReady && !R.profile) return vBoot();
  if (!coreReady() && !R.profile) return vBoot();
  if (!R.profile) return vOnboard();
  if (U.tab === 'personas' && !R.host) U.tab = 'inicio';
  switch (U.tab) {
    case 'cats': { const c = C(U.cat); return c ? vCat(c) : vCats(); }
    case 'partidos': return vPartidos();
    case 'entreno': return vEntreno();
    case 'lista': if (!U.lcat || !D.cats[U.lcat]) { const c = cats()[0]; U.lcat = c ? c.id : ''; syncSubs(); } return vLista();
    case 'pagos': return vPagos();
    case 'personas': return vPersonas();
    default: return vInicio();
  }
}
const shown = new WeakMap();
function setHtml(el, h) { if (shown.get(el) === h) return false; shown.set(el, h); el.innerHTML = h; return true; }
function navEnd() { const n = $('#nav'); n.classList.toggle('end', n.scrollLeft + n.clientWidth >= n.scrollWidth - 4); }
$('#nav').addEventListener('scroll', navEnd, { passive: true });
addEventListener('resize', navEnd);
function draw() {
  const app = $('#app');
  const f = grabForm(app);
  const inApp = R.boot === 'ready' && !!R.profile;
  document.body.classList.toggle('gated', !inApp);
  document.body.classList.toggle('host', !!R.host);
  setHtml($('#role'), inApp ? headerRole(st) : '');
  setHtml($('#me'), inApp ? headerMe() : '');
  const nav = $('#nav'), sl = nav.scrollLeft;
  if (setHtml(nav, inApp ? navHtml() : '')) nav.scrollLeft = sl;
  navEnd();
  try { app.innerHTML = view(); }
  catch (e) {
    console.error(e);
    app.innerHTML = gateHead('Algo no se mostró bien') + `<div class="card center"><div class="mute" style="margin-bottom:12px">Toca el botón para recargar la app. Tus datos y tu sesión no se borran.</div><button class="btn" data-act="repair">Reparar y recargar</button><div class="mute small" style="margin-top:10px">${esc(String(e && e.message || e)).slice(0, 140)}</div></div>`;
    return;
  }
  putForm(app, f);
  hydrate(document.body);
  if (sheetRefresh) sheetRefresh();
}

B.onStatus(s => {
  const was = st; st = s;
  const r = $('#role');
  if (r && R.profile && R.boot === 'ready') setHtml(r, headerRole(st));
  if (was.online && !s.online) toast('Sin conexión. Puedes seguir usando la app: los cambios se guardan y se envían al volver el internet.', { ms: 5000 });
  if (!was.online && s.online) toast('Conexión de nuevo. Sincronizando…', { ok: true });
});
B.onError((e, what) => {
  const c = e && e.code;
  if (c === 'permission-denied') toast(R.host ? 'El servidor no aceptó el cambio. ¿Sigues siendo anfitrión?' : 'Solo un anfitrión puede hacer ese cambio.');
  else if (c === 'resource-exhausted') toast('Se llenó el espacio de guardado. Usa fotos más livianas.');
  else if (c && c !== 'cancelled') toast('No se pudo guardar (' + c + '). Se reintentará.');
});

// Cambios en lo que se guarda en el aparato entre versiones (nunca borrar: migrar).
const DATA_V = 1;
function migrate() {
  const v = LS.get('dv', 0);
  // if (v < 2) { …convertir datos viejos al formato nuevo… }
  if (v !== DATA_V) LS.set('dv', DATA_V);
}

async function boot() {
  migrate();
  render();
  try { await B.start(); }
  catch (e) {
    R.boot = 'error';
    R.bootErr = navigator.onLine ? 'No se pudo conectar con el servidor del club. Revisa tu conexión e inténtalo de nuevo.' : 'La primera vez se necesita internet (wifi o datos) para entrar.';
    render();
    addEventListener('online', () => location.reload(), { once: true });
    return;
  }
  await restoreHost();
  R.profile = B.me.get();
  if (R.profile) R.meReady = true;
  watchCore();
  watchRole();
  R.boot = 'ready';
  render();
  // Marca "visto por última vez" (como mucho cada 6 horas).
  setTimeout(() => {
    if (R.profile && D.users[B.uid] && Date.now() - (D.users[B.uid].last || 0) > 6 * 3600 * 1000) B.update('users/' + B.uid, { last: Date.now() });
  }, 4000);
}
boot();

// La fecha cambia a medianoche: refresca "Hoy", próximos partidos, etc.
setInterval(render, 60 * 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
addEventListener('appinstalled', render);

// ── Actualizaciones ─────────────────────────────────────────────────────────
// Cada aparato revisa si se publicó una versión nueva (al abrir, al volver a la app
// y cada 3 minutos). Si la hay, se recarga solo en un momento seguro: con todo
// guardado en el servidor y sin nadie escribiendo. Los datos están en Firebase y la
// sesión en el aparato, así que recargar no borra nada.
let nueva = null, espera = 0;
async function checkUpdate() {
  if (!navigator.onLine || VERSION === 'dev') return;
  try {
    const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return;
    const j = await r.json();
    if (j && j.v && j.v !== VERSION) { nueva = j.v; tryReload(); }
  } catch (e) {}
}
function dirty() {
  return Array.from(document.querySelectorAll('#app input[data-keep], #app textarea[data-keep]')).some(e => e.value !== e.defaultValue);
}
function busy() {
  if (B.status().pending > 0) return true;               // algo se está enviando al servidor
  if (document.hidden) return false;                      // la app está en segundo plano: buen momento
  if (document.querySelector('.veil')) return true;       // hay una ventana abierta (foto, código, hoja…)
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return true; // alguien está escribiendo
  return !!OB.photo || dirty();                           // registro o formulario a medio llenar
}
function tryReload() {
  if (!nueva || !navigator.onLine) return;
  const last = LS.get('upd');
  if (last && last.v === nueva && Date.now() - last.t < 120000) return; // ya se recargó por esta versión hace poco
  if (busy()) { clearTimeout(espera); espera = setTimeout(tryReload, 3000); return; }
  LS.set('upd', { v: nueva, t: Date.now() });
  if (!document.hidden) toast('Hay una versión nueva. Actualizando…', { ok: true, ms: 3000 });
  setTimeout(() => location.reload(), document.hidden ? 50 : 1200);
}
(function afterUpdate() {
  const last = LS.get('upd');
  if (last && last.v === VERSION) { LS.del('upd'); setTimeout(() => toast('App actualizada ✓', { ok: true }), 800); }
})();
setTimeout(checkUpdate, 8000);
setInterval(() => { if (!document.hidden) checkUpdate(); }, 3 * 60 * 1000);
document.addEventListener('visibilitychange', () => { if (document.hidden) tryReload(); else checkUpdate(); });
addEventListener('online', () => setTimeout(checkUpdate, 1500));
window.__esCheckUpdate = checkUpdate;

// La app se guarda en el celular para abrir sin internet (siempre trae la última versión si hay red).
if ('serviceWorker' in navigator && window.isSecureContext && window.top === window) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
  // Si otra app del mismo dominio borró la copia sin internet, se rehace.
  navigator.serviceWorker.ready.then(r => { setTimeout(() => r.active && r.active.postMessage('fill'), 5000); }).catch(() => {});
}
