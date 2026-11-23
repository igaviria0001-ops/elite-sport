// Arranque de Elite Sport: sesión, datos en vivo y dibujo de la pantalla.
import * as B from './backend.js';
import { D, U, R, C, cats, watchCore, watchRole, coreReady, onRedraw, syncSubs } from './state.js';
import { vBoot, vOnboard, vInicio, vCats, vCat, vPartidos, vEntreno, vLista, vPagos, vPersonas, headerRole, headerMe, navHtml } from './views.js';
import { bindActions, hydrate, sheetRefresh } from './actions.js';
import { toast, LS } from './util.js';

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
  app.innerHTML = view();
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

async function boot() {
  render();
  try { await B.start(); }
  catch (e) {
    R.boot = 'error';
    R.bootErr = navigator.onLine ? 'No se pudo conectar con el servidor del club. Revisa tu conexión e inténtalo de nuevo.' : 'La primera vez se necesita internet (wifi o datos) para entrar.';
    render();
    addEventListener('online', () => location.reload(), { once: true });
    return;
  }
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

// La app se guarda en el celular para abrir sin internet (siempre trae la última versión si hay red).
if ('serviceWorker' in navigator && location.protocol === 'https:' && window.top === window) navigator.serviceWorker.register('sw.js').catch(() => {});
