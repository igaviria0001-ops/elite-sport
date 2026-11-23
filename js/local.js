// Modo local: imita la parte de Firebase que usa la app, guardando todo en este
// aparato (localStorage). Sirve para ver la app sin servidor y para las pruebas
// automáticas (varias pestañas = varias personas, con ?who=nombre).
// Incluye una copia de las reglas de seguridad para que los permisos se
// comporten igual que en Firebase. El código de anfitrión del modo local es DEMO.
import { LS } from './util.js';

const LOCAL_CODE = 'DEMO';
const OLD_RULES = new URLSearchParams(location.search).has('viejas'); // pruebas: reglas sin «tels»
const KEY = 'esl_db', IKEY = 'esl_img_';
const CAN = (() => { try { localStorage.setItem('esl_t', '1'); localStorage.removeItem('esl_t'); return true; } catch (e) { return false; } })();
const IMG = new Map(); // fotos en memoria (por si el navegador no deja guardar)
let DB = load();
const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('esl') : null;
const subs = new Set();

function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } }
function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
function getRaw(path) {
  if (path.startsWith('img/') && IMG.has(path)) return IMG.get(path);
  if (path.startsWith('img/')) { try { const v = localStorage.getItem(IKEY + path.slice(4)); return v ? JSON.parse(v) : undefined; } catch (e) { return undefined; } }
  return DB[path];
}
function persist(changed) {
  const imgs = changed.filter(p => p.startsWith('img/'));
  for (const p of imgs) {
    const v = DB[p]; delete DB[p];
    if (v === undefined) IMG.delete(p); else IMG.set(p, v);
    if (!CAN) continue;
    if (v === undefined) localStorage.removeItem(IKEY + p.slice(4));
    else localStorage.setItem(IKEY + p.slice(4), JSON.stringify(v));
  }
  if (CAN) localStorage.setItem(KEY, JSON.stringify(DB));
  bc && bc.postMessage({ paths: changed });
}
if (bc) bc.onmessage = e => { DB = load(); notify(e.data.paths || []); };
addEventListener('storage', e => { if (e.key === KEY) { DB = load(); notify(null); } });

function err(code, msg) { return Object.assign(new Error(msg || code), { code }); }

// ── Auth ────────────────────────────────────────────────────────────────────
export function initializeApp(cfg) { return { cfg }; }
export const indexedDBLocalPersistence = 'idb', browserLocalPersistence = 'ls';
const authFns = new Set();
let user = LS.get('luid') ? { uid: LS.get('luid'), isAnonymous: true } : null;
export function initializeAuth() { return {}; }
export function onAuthStateChanged(_a, cb) {
  authFns.add(cb); setTimeout(() => authFns.has(cb) && cb(user), 0);
  return () => authFns.delete(cb);
}
export async function signInAnonymously() {
  if (!user) { user = { uid: 'u' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-4), isAnonymous: true }; LS.set('luid', user.uid); }
  else if (!LS.get('luid')) LS.set('luid', user.uid);
  authFns.forEach(f => f(user));
  return { user };
}

// ── Firestore ───────────────────────────────────────────────────────────────
export function initializeFirestore() { return {}; }
export function persistentLocalCache() { return {}; }
export function persistentMultipleTabManager() { return {}; }
export function memoryLocalCache() { return {}; }
export function doc(_db, ...s) { return { type: 'doc', path: s.join('/') }; }
export function collection(_db, ...s) { return { type: 'col', path: s.join('/') }; }
export function where(f, op, v) { return { k: 'where', f, op, v }; }
export function orderBy(f, d = 'asc') { return { k: 'order', f, d }; }
export function limit(n) { return { k: 'limit', n }; }
export function query(c, ...cons) { return { type: 'query', path: c.path, cons }; }
export function deleteField() { return { __op: 'del' }; }
export function arrayUnion(...v) { return { __op: 'union', v }; }
export function arrayRemove(...v) { return { __op: 'remove', v }; }

const isSent = v => v && typeof v === 'object' && !Array.isArray(v) && v.__op;
const isMap = v => v && typeof v === 'object' && !Array.isArray(v) && !v.__op;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function applySent(old, s) {
  const arr = Array.isArray(old) ? old.slice() : [];
  if (s.__op === 'union') { s.v.forEach(x => { if (!arr.some(y => same(x, y))) arr.push(clone(x)); }); return arr; }
  if (s.__op === 'remove') return arr.filter(y => !s.v.some(x => same(x, y)));
  return undefined;
}
function resolve(v) { // valores de un set sin merge
  if (isSent(v)) { if (v.__op === 'del') throw err('invalid-argument', 'deleteField en set'); return applySent(undefined, v); }
  if (isMap(v)) { const o = {}; for (const k in v) { const r = resolve(v[k]); if (r !== undefined) o[k] = r; } return o; }
  return clone(v);
}
function merge(base, data) {
  const o = isMap(base) ? clone(base) : {};
  for (const k in data) {
    const v = data[k];
    if (isSent(v)) { const r = v.__op === 'del' ? undefined : applySent(o[k], v); if (r === undefined) delete o[k]; else o[k] = r; }
    else if (isMap(v)) o[k] = merge(o[k], v);
    else o[k] = clone(v);
  }
  return o;
}
function updatePaths(base, data) {
  const o = clone(base);
  for (const k in data) {
    const parts = k.split('.'), last = parts.pop();
    let cur = o;
    for (const p of parts) { if (!isMap(cur[p])) cur[p] = {}; cur = cur[p]; }
    const v = data[k];
    if (isSent(v)) { const r = v.__op === 'del' ? undefined : applySent(cur[last], v); if (r === undefined) delete cur[last]; else cur[last] = r; }
    else cur[last] = resolve(v);
  }
  return o;
}

// ── Copia de las reglas de seguridad (firestore.rules) ─────────────────────
const OPEN = ['cats', 'players', 'matches', 'rivals', 'train', 'kits', 'att', 'club'];
const isHost = u => !!(u && DB['hostkeys/' + LOCAL_CODE + '/members/' + u]);
const keysOnly = (d, ks) => Object.keys(d || {}).every(k => ks.includes(k));
function canWrite(path, op, next, prev) {
  const u = user && user.uid, s = path.split('/');
  if (!u) return false;
  if (s[0] === 'hostkeys' && s[2] === 'members' && s.length === 4) {
    if (op === 'delete') return isHost(u);
    return s[3] === u && s[1] === LOCAL_CODE && keysOnly(next, ['name', 't']);
  }
  if (s[0] === 'users' && s.length === 2) {
    if (op === 'delete') return isHost(u);
    const okData = next && typeof next.name === 'string' && next.name.length >= 3 && next.name.length <= 50 &&
      keysOnly(next, OLD_RULES ? ['name', 'photo', 'cat', 't', 'last', 'np'] : ['name', 'photo', 'cat', 't', 'last', 'np', 'kit']) && (next.photo == null || (typeof next.photo === 'string' && next.photo.length <= 40)) && (next.kit == null || ['red', 'black'].includes(next.kit));
    if (isHost(u)) return okData;
    const npChanged = !same((prev || {}).np, (next || {}).np);
    return s[1] === u && okData && !npChanged;
  }
  if (s[0] === 'tels' && s.length === 2) {
    if (OLD_RULES) return false;
    if (op === 'delete') return isHost(u) || s[1] === u;
    return (s[1] === u || isHost(u)) && keysOnly(next, ['tel', 't']) && typeof next.tel === 'string' && /^[0-9]{11,15}$/.test(next.tel);
  }
  if (s[0] === 'img' && s.length === 2) {
    if (op === 'delete') return isHost(u) || (prev && prev.by === u);
    if (prev) return false;
    return keysOnly(next, ['d', 'by', 't']) && next.by === u && typeof next.d === 'string' && next.d.length < 900000;
  }
  if (s.length === 2 && (OPEN.includes(s[0]) || s[0] === 'pay' || s[0] === 'log')) return isHost(u);
  return false;
}
function canRead(path, list) {
  const u = user && user.uid, s = path.split('/');
  if (!u) return false;
  if (s[0] === 'hostkeys') return list ? isHost(u) : (s[3] === u || isHost(u));
  if (s[0] === 'users') return true;
  if (s[0] === 'tels') return !OLD_RULES && (list ? isHost(u) : (s[1] === u || isHost(u)));
  if (s[0] === 'img') return !list;
  if (s[0] === 'log') return isHost(u);
  if (s[0] === 'pay') { if (list) return isHost(u); const pl = DB['players/' + s[1]]; return isHost(u) || !!(pl && pl.uid === u); }
  return OPEN.includes(s[0]);
}

// ── Escrituras ──────────────────────────────────────────────────────────────
function plan(ref, kind, data, opts) {
  const prev = getRaw(ref.path);
  let next;
  if (kind === 'set') next = opts && opts.merge ? merge(prev, data) : resolve(data);
  else if (kind === 'update') { if (prev === undefined) throw err('not-found', 'No existe ' + ref.path); next = updatePaths(prev, data); }
  else next = undefined;
  const op = kind === 'delete' ? 'delete' : prev === undefined ? 'create' : 'update';
  if (!canWrite(ref.path, op, next, prev)) throw err('permission-denied', 'Sin permiso: ' + ref.path);
  return [ref.path, next];
}
function commit(changes) {
  for (const [p, v] of changes) { if (v === undefined) delete DB[p]; else DB[p] = v; }
  try { persist(changes.map(c => c[0])); }
  catch (e) { DB = load(); notify(null); throw err('resource-exhausted', 'El aparato no tiene espacio para guardar más.'); }
  notify(changes.map(c => c[0]));
}
const later = () => new Promise(r => setTimeout(r, 0));
export async function setDoc(ref, data, opts) { await later(); commit([plan(ref, 'set', data, opts)]); }
export async function updateDoc(ref, data) { await later(); commit([plan(ref, 'update', data)]); }
export async function deleteDoc(ref) { await later(); commit([plan(ref, 'delete')]); }
export function writeBatch() {
  const ops = [];
  const b = {
    set(r, d, o) { ops.push([r, 'set', d, o]); return b; },
    update(r, d) { ops.push([r, 'update', d]); return b; },
    delete(r) { ops.push([r, 'delete']); return b; },
    async commit() {
      await later();
      const saved = DB, tmp = {};
      try {
        const ch = [];
        for (const o of ops) { const c = plan(o[0], o[1], o[2], o[3]); ch.push(c); tmp[c[0]] = c[1]; DB = Object.assign({}, DB, { [c[0]]: c[1] }); }
        DB = saved; commit(ch);
      } catch (e) { DB = saved; throw e; }
    }
  };
  return b;
}

// ── Lecturas ────────────────────────────────────────────────────────────────
function snapDoc(path) {
  const v = getRaw(path);
  return { id: path.split('/').pop(), exists: () => v !== undefined, data: () => clone(v), metadata: { fromCache: false, hasPendingWrites: false } };
}
const field = (d, f) => f.split('.').reduce((a, k) => (a == null ? undefined : a[k]), d);
function runQuery(q) {
  const pre = q.path + '/', depth = q.path.split('/').length + 1;
  let rows = Object.keys(DB).filter(p => p.startsWith(pre) && p.split('/').length === depth).map(p => ({ p, d: DB[p] }));
  for (const c of q.cons || []) {
    if (c.k === 'where') rows = rows.filter(r => {
      const x = field(r.d, c.f);
      switch (c.op) {
        case '==': return same(x, c.v); case '!=': return !same(x, c.v);
        case 'in': return c.v.some(v => same(x, v));
        case '<': return x < c.v; case '<=': return x <= c.v; case '>': return x > c.v; case '>=': return x >= c.v;
      } return false;
    });
  }
  const ord = (q.cons || []).filter(c => c.k === 'order');
  if (ord.length) rows.sort((a, b) => { for (const o of ord) { const x = field(a.d, o.f), y = field(b.d, o.f); if (x !== y) return (x < y ? -1 : 1) * (o.d === 'desc' ? -1 : 1); } return 0; });
  const lim = (q.cons || []).find(c => c.k === 'limit');
  if (lim) rows = rows.slice(0, lim.n);
  const docs = rows.map(r => ({ id: r.p.split('/').pop(), exists: () => true, data: () => clone(r.d) }));
  return { docs, size: docs.length, empty: !docs.length, forEach: f => docs.forEach(f), metadata: { fromCache: false, hasPendingWrites: false } };
}
export async function getDoc(ref) { await later(); if (!canRead(ref.path, false)) throw err('permission-denied'); return snapDoc(ref.path); }
export async function getDocs(q) { await later(); if (!canRead(q.path + '/x', true)) throw err('permission-denied'); return runQuery(q.type === 'col' ? { path: q.path, cons: [] } : q); }

export function onSnapshot(target, a, b, c) {
  const opts = a && typeof a === 'object' && typeof a !== 'function' ? a : null;
  const next = opts ? b : a, onErr = opts ? c : b;
  const isDoc = target.type === 'doc';
  const q = isDoc ? null : (target.type === 'col' ? { path: target.path, cons: [] } : target);
  const s = { isDoc, path: target.path, q, next, onErr, dead: false, last: null };
  subs.add(s);
  setTimeout(() => fire(s), 0);
  return () => { s.dead = true; subs.delete(s); };
}
function fire(s) {
  if (s.dead) return;
  const allowed = s.isDoc ? canRead(s.path, false) : canRead(s.path + '/x', true);
  if (!allowed) { s.dead = true; subs.delete(s); s.onErr && s.onErr(err('permission-denied', 'Sin permiso para leer ' + s.path)); return; }
  const snap = s.isDoc ? snapDoc(s.path) : runQuery(s.q);
  const sig = s.isDoc ? JSON.stringify(getRaw(s.path) === undefined ? null : getRaw(s.path)) : JSON.stringify(snap.docs.map(d => [d.id, d.data()]));
  if (sig === s.last) return;
  s.last = sig;
  try { s.next(snap); } catch (e) { console.error(e); }
}
let queued = null;
function notify(paths) {
  if (!queued) { queued = new Set(); setTimeout(flush, 0); }
  if (paths === null) queued.add('*'); else paths.forEach(p => queued.add(p));
}
function flush() {
  const ps = queued; queued = null;
  const all = ps.has('*') || [...ps].some(p => p.startsWith('hostkeys/') || p.startsWith('players/'));
  for (const s of [...subs]) {
    if (all) { fire(s); continue; }
    for (const p of ps) {
      if (s.isDoc ? p === s.path : p.slice(0, p.lastIndexOf('/')) === s.q.path) { fire(s); break; }
    }
  }
}
