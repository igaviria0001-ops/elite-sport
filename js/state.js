// Estado de la app: datos sincronizados, interfaz, rol y suscripciones en vivo.
import * as B from './backend.js';
import { LS, today, thisMonth, byName, norm } from './util.js';

// Datos que llegan del servidor (siempre al día).
export const D = {
  cats: {}, players: {}, matches: {}, rivals: {}, train: {}, kits: {}, users: {}, club: {},
  pay: {}, log: {}, hosts: {}, att: null, attCat: {}, myPay: null
};
export const loaded = new Set();

// Estado de la interfaz (solo en este aparato).
export const U = {
  tab: LS.get('tab', 'inicio'), cat: null, slot: null,
  date: today(), kind: 'Entrenamiento', lcat: '',
  month: thisMonth(), pcat: '', pfil: 'todos', pq: '',
  fcat: LS.get('fcat', null), pastN: 8, personas: 'nuevas'
};

// Rol y perfil propio.
export const R = { host: false, key: null, meReady: false, profile: null, boot: 'loading', bootErr: '' };

// ── Consultas sobre los datos ───────────────────────────────────────────────
export const list = (o, sort) => Object.keys(o || {}).map(id => Object.assign({ id }, o[id])).sort(sort || ((a, b) => (a.t || 0) - (b.t || 0)));
export const cats = () => list(D.cats, (a, b) => byName(a.name, b.name));
export const C = id => (id && D.cats[id] ? Object.assign({ id }, D.cats[id]) : null);
export const P = id => (id && D.players[id] ? Object.assign({ id }, D.players[id]) : null);
export const cname = id => (D.cats[id] ? D.cats[id].name : '');
const numSort = (a, b) => {
  const x = parseInt(a.num, 10), y = parseInt(b.num, 10);
  if (!isNaN(x) && !isNaN(y) && x !== y) return x - y;
  if (isNaN(x) !== isNaN(y)) return isNaN(x) ? 1 : -1;
  return byName(a.name, b.name);
};
export const players = cat => list(D.players, numSort).filter(p => !cat || p.cat === cat);
export const playersByName = () => list(D.players, (a, b) => byName(a.name, b.name));
export const myPlayer = () => list(D.players).find(p => p.uid && p.uid === B.uid) || null;
export const playerOfUser = u => list(D.players).find(p => p.uid === u) || null;
export const userOf = p => (p && p.uid && D.users[p.uid]) || null;
export const photoOf = p => (p ? p.photo || (userOf(p) || {}).photo || '' : '');
export const myName = () => (R.profile && R.profile.name) || 'Anfitrión';
export const users = () => list(D.users, (a, b) => (b.t || 0) - (a.t || 0));
export const isHostUser = u => !!D.hosts[u];
export const pendingUsers = () => users().filter(u => !u.np && !playerOfUser(u.id) && !isHostUser(u.id));
export const feeOf = catId => { const c = D.cats[catId]; return c && +c.fee > 0 ? +c.fee : 0; };
export const paidOf = (pid, ym) => { const p = R.host ? D.pay[pid] : D.myPay; return (p && p.m && p.m[ym]) || null; };
export const attId = () => `${U.date}_${U.kind}_${U.lcat}`;
// Sugerencia: jugador del plantel (sin vincular) con el mismo nombre que la persona.
export function nameMatch(name) {
  const w = norm(name).split(/\s+/).filter(x => x.length > 2);
  if (w.length < 2) return null;
  let best = null, bs = 0;
  for (const p of list(D.players)) {
    if (p.uid) continue;
    const pw = norm(p.name).split(/\s+/);
    const s = w.filter(x => pw.includes(x)).length;
    if (s >= 2 && s > bs) { best = p; bs = s; }
  }
  return best;
}

// ── Borrar a una persona de todas partes (solo anfitriones) ────────────────
// Perfil y foto, ficha del plantel con sus pagos y su lugar en las alineaciones,
// entradas del registro que la nombran, su nombre en los pagos que marcó y su
// acceso de anfitrión. Lo que creó para el club (categorías, partidos…) se queda.
export async function eraseOps(uidv, { ficha = true } = {}) {
  const u = D.users[uidv] || {}, names = new Set();
  if (u.name) names.add(u.name);
  const mine = list(D.players).filter(p => p.uid === uidv);
  const ops = [['del', 'users/' + uidv]];
  if (u.photo) ops.push(['del', 'img/' + u.photo]);
  const gone = new Set();
  for (const p of mine) {
    if (!ficha) { ops.push(['update', 'players/' + p.id, { uid: B.DEL() }]); continue; }
    names.add(p.name); gone.add(p.id);
    ops.push(['del', 'players/' + p.id], ['del', 'pay/' + p.id]);
    if (p.photo) ops.push(['del', 'img/' + p.photo]);
    cats().forEach(c => Object.keys(c.lineup || {}).forEach(i => { if (c.lineup[i] === p.id) ops.push(['update', 'cats/' + c.id, { ['lineup.' + i]: B.DEL() }]); }));
  }
  let logs = D.log;
  try { logs = await B.getAll('log'); } catch (e) {}
  for (const id in logs) {
    const l = logs[id] || {};
    if (l.u === uidv || names.has(l.w) || [...names].some(n => String(l.x || '').includes(n))) ops.push(['del', 'log/' + id]);
  }
  for (const pid in D.pay) {
    if (gone.has(pid)) continue;
    const m = (D.pay[pid] || {}).m || {};
    for (const ym in m) if (m[ym] && names.has(m[ym].by)) ops.push(['set', 'pay/' + pid, { m: { [ym]: { by: '' } } }]);
  }
  if (D.hosts[uidv] && R.key && uidv !== B.uid) ops.push(['del', `hostkeys/${R.key}/members/${uidv}`]);
  return ops;
}

// ── Suscripciones en vivo ───────────────────────────────────────────────────
const subs = {};
let redraw = () => {};
export function onRedraw(fn) { redraw = fn; }
function sub(name, key, fn) {
  if (subs[name] && subs[name].key === key) return;
  unsub(name);
  subs[name] = { key, off: fn() };
}
export function unsub(name) { if (subs[name]) { try { subs[name].off(); } catch (e) {} delete subs[name]; } }

const CORE = ['cats', 'players', 'matches', 'rivals', 'train', 'kits', 'users'];
export function watchCore() {
  for (const c of CORE) sub(c, 1, () => B.watchCol(c, d => { D[c] = d; loaded.add(c); if (c === 'players') syncSubs(); redraw(); }));
  // Perfil propio: se espera la respuesta del servidor antes de pedir el registro.
  sub('me', 1, () => B.watchDoc('users/' + B.uid, (d, m) => {
    if (d) { R.profile = d; B.me.set(d); R.meReady = true; }
    else if (!m.fromCache || !navigator.onLine) { if (!m.fromCache) { R.profile = null; B.me.set(null); } R.meReady = true; }
    redraw();
  }, null, true));
}
export function coreReady() { return CORE.every(c => loaded.has(c)) || !navigator.onLine; }

export function watchRole() {
  const hk = LS.get('hk');
  if (hk && hk.uid === B.uid && hk.key) { R.host = true; R.key = hk.key; }
  if (!R.key) return syncSubs();
  sub('role', R.key, () => B.watchHost(R.key, (ok, m) => {
    if (ok) { if (!R.host) { R.host = true; } }
    else if (!m.fromCache) { R.host = false; R.key = null; LS.del('hk'); B.kv.set('hk', null); unsub('role'); }
    syncSubs(); redraw();
  }));
  syncSubs();
}
export async function restoreHost() {
  if (LS.get('hk')) return;
  try { const k = await B.kv.get('hk'); if (k && k.uid === B.uid && k.key) LS.set('hk', k); } catch (e) {}
}
export function becomeHost(key) {
  LS.set('hk', { uid: B.uid, key }); B.kv.set('hk', { uid: B.uid, key });
  R.host = true; R.key = key;
  watchRole(); redraw();
}
export function stopHost() {
  LS.del('hk'); B.kv.set('hk', null); R.host = false; R.key = null; unsub('role'); syncSubs(); redraw();
}

// Abre o cierra las lecturas según el rol y la pestaña.
export function syncSubs() {
  if (R.host && R.key) {
    sub('pay', 1, () => B.watchCol('pay', d => { D.pay = d; redraw(); }));
    sub('log', 1, () => B.watchCol('log', d => { D.log = d; redraw(); }, [['orderBy', 't', 'desc'], ['limit', 25]]));
    sub('hosts', R.key, () => B.watchCol(`hostkeys/${R.key}/members`, d => { D.hosts = d; redraw(); }));
    unsub('mypay'); unsub('attcat');
  } else {
    unsub('pay'); unsub('log'); unsub('hosts');
    D.pay = {}; D.log = {}; D.hosts = {};
    const mp = myPlayer();
    if (mp) {
      sub('mypay', mp.id, () => B.watchDoc('pay/' + mp.id, d => { D.myPay = d; redraw(); }, () => { D.myPay = null; }));
    } else { unsub('mypay'); D.myPay = null; }
  }
  // Asistencia: solo se lee cuando se está en esa pestaña.
  if (U.tab === 'lista') {
    if (R.host) {
      if (U.lcat) sub('att', attId(), () => { D.att = null; return B.watchDoc('att/' + attId(), d => { D.att = d; redraw(); }); });
      unsub('attcat');
    } else {
      unsub('att');
      const mp = myPlayer();
      if (mp && mp.cat) sub('attcat', mp.cat, () => B.watchCol('att', d => { D.attCat = d; redraw(); }, [['where', 'cat', '==', mp.cat]]));
      else unsub('attcat');
    }
  } else { unsub('att'); unsub('attcat'); }
}
