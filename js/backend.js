// Capa de datos de Elite Independiente.
// Habla con Firestore (Firebase) usando su API modular. Si config.js está vacío,
// usa local.js, que imita la misma API dentro del aparato (modo local / pruebas).
import { FIREBASE } from './config.js';
import { LS, WHO, rid } from './util.js';

let F = null, db = null, auth = null;
export let uid = null;
export let MODE = 'local';

const pending = new Set();
const statusFns = new Set();
let errorFn = () => {};
export function onStatus(fn) { statusFns.add(fn); fn(status()); }
export function onError(fn) { errorFn = fn; }
export function status() { return { online: navigator.onLine !== false, pending: pending.size, mode: MODE }; }
function emit() { const s = status(); statusFns.forEach(f => f(s)); }
addEventListener('online', emit);
addEventListener('offline', emit);

function hasConfig() { return !!(FIREBASE && FIREBASE.apiKey && FIREBASE.projectId && FIREBASE.appId); }

export async function start() {
  const forceLocal = !!WHO || new URLSearchParams(location.search).has('local');
  if (hasConfig() && !forceLocal) { F = await import('./vendor/firebase.js'); MODE = 'firebase'; }
  else { F = await import('./local.js'); MODE = 'local'; }
  const app = F.initializeApp(MODE === 'firebase' ? FIREBASE : { projectId: 'elite-local' });
  auth = F.initializeAuth(app, { persistence: [F.indexedDBLocalPersistence, F.browserLocalPersistence] });
  try {
    db = F.initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager(), cacheSizeBytes: 100 * 1024 * 1024 })
    });
  } catch (e) {
    db = F.initializeFirestore(app, { ignoreUndefinedProperties: true, localCache: F.memoryLocalCache() });
  }
  uid = await new Promise((ok, no) => {
    let tried = false;
    const off = F.onAuthStateChanged(auth, u => {
      if (u) { off(); ok(u.uid); return; }
      if (!tried) { tried = true; F.signInAnonymously(auth).catch(e => { off(); no(e); }); }
    }, e => no(e));
  });
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}
  emit();
  return uid;
}

// ── Referencias ─────────────────────────────────────────────────────────────
const ref = p => F.doc(db, ...p.split('/'));
const col = p => F.collection(db, ...p.split('/'));
export const DEL = () => F.deleteField();
export const UNION = (...a) => F.arrayUnion(...a);
export const REMOVE = (...a) => F.arrayRemove(...a);

// ── Escrituras ──────────────────────────────────────────────────────────────
// Firestore guarda primero en el aparato (se ve al instante y sobrevive sin
// conexión) y luego lo envía. La promesa termina cuando el servidor confirma.
function track(p, what) {
  pending.add(p); emit();
  p.catch(e => errorFn(e, what)).finally(() => { pending.delete(p); emit(); });
  return p;
}
export function set(path, data, merge = true) { return track(F.setDoc(ref(path), data, merge ? { merge: true } : {}), path); }
export function update(path, data) { return track(F.updateDoc(ref(path), data), path); }
export function del(path) { return track(F.deleteDoc(ref(path)), path); }
// ops: [['set', path, data, merge?], ['update', path, data], ['del', path]]
export function batch(ops) {
  const chunks = [];
  for (let i = 0; i < ops.length; i += 450) chunks.push(ops.slice(i, i + 450));
  return Promise.all(chunks.map(ch => {
    const b = F.writeBatch(db);
    ch.forEach(o => {
      if (o[0] === 'set') b.set(ref(o[1]), o[2], o[3] === false ? {} : { merge: true });
      else if (o[0] === 'update') b.update(ref(o[1]), o[2]);
      else if (o[0] === 'del') b.delete(ref(o[1]));
    });
    return track(b.commit(), 'batch');
  }));
}

// ── Lecturas en vivo ────────────────────────────────────────────────────────
// q: [['where', campo, op, valor], ['orderBy', campo, 'desc'], ['limit', n]]
export function watchCol(path, cb, q, onErr) {
  let r = col(path);
  if (q && q.length) r = F.query(r, ...q.map(c => c[0] === 'where' ? F.where(c[1], c[2], c[3]) : c[0] === 'orderBy' ? F.orderBy(c[1], c[2] || 'asc') : F.limit(c[1])));
  return F.onSnapshot(r, s => {
    const out = {};
    s.forEach(d => { out[d.id] = d.data(); });
    cb(out, s.metadata || {});
  }, e => { console.warn('watch', path, e && e.code); onErr && onErr(e); });
}
export function watchDoc(path, cb, onErr, withMeta) {
  const next = s => cb(s.exists() ? s.data() : null, s.metadata || {});
  const fail = e => { console.warn('watch', path, e && e.code); onErr && onErr(e); };
  return withMeta ? F.onSnapshot(ref(path), { includeMetadataChanges: true }, next, fail) : F.onSnapshot(ref(path), next, fail);
}

export async function getAll(path) {
  const s = await F.getDocs(col(path)), out = {};
  s.forEach(d => { out[d.id] = d.data(); });
  return out;
}

// ── Anfitrión ───────────────────────────────────────────────────────────────
// El código solo existe en las reglas del servidor: se intenta crear
// hostkeys/{código}/members/{uid}; si el servidor lo acepta, el código es correcto.
export async function tryHostCode(code, name) {
  if (!/^[A-Z0-9]{2,16}$/.test(code)) return false;
  const p = `hostkeys/${code}/members/${uid}`;
  const w = F.setDoc(ref(p), { name: String(name || '').slice(0, 50), t: Date.now() });
  pending.add(w); emit();
  const timeout = new Promise((_, no) => setTimeout(() => no(Object.assign(new Error('sin conexión'), { code: 'timeout' })), 15000));
  try { await Promise.race([w, timeout]); return true; }
  catch (e) {
    if (e && e.code === 'permission-denied') return false;
    throw e;
  } finally { w.catch(() => {}).finally(() => { pending.delete(w); emit(); }); }
}
export function watchHost(key, cb) { return watchDoc(`hostkeys/${key}/members/${uid}`, (d, m) => cb(!!d, m), null, true); }

// ── Imágenes ────────────────────────────────────────────────────────────────
// Cada foto es un documento inmutable img/{id}. Se descarga una sola vez y se
// guarda en el aparato (IndexedDB), así la app gasta pocos datos móviles.
const mem = new Map(), inflight = new Map();
let idbP = null;
function idb() {
  if (idbP) return idbP;
  idbP = new Promise(ok => {
    try {
      const r = indexedDB.open('es-img' + (WHO ? '-' + WHO : ''), 1);
      r.onupgradeneeded = () => r.result.createObjectStore('i');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ok(null);
    } catch (e) { ok(null); }
  });
  return idbP;
}
async function idbGet(id) {
  const d = await idb(); if (!d) return null;
  return new Promise(ok => { try { const q = d.transaction('i').objectStore('i').get(id); q.onsuccess = () => ok(q.result || null); q.onerror = () => ok(null); } catch (e) { ok(null); } });
}
async function idbPut(id, v) {
  const d = await idb(); if (!d) return;
  try { d.transaction('i', 'readwrite').objectStore('i').put(v, id); } catch (e) {}
}
function toUrl(dataUrl) {
  try {
    const i = dataUrl.indexOf(','), mime = dataUrl.slice(5, dataUrl.indexOf(';'));
    const raw = atob(dataUrl.slice(i + 1)), a = new Uint8Array(raw.length);
    for (let k = 0; k < raw.length; k++) a[k] = raw.charCodeAt(k);
    return URL.createObjectURL(new Blob([a], { type: mime }));
  } catch (e) { return dataUrl; }
}
// Respaldo de datos del aparato (clave de anfitrión) por si se borra localStorage.
export const kv = { get: k => idbGet('__' + k), set: (k, v) => idbPut('__' + k, v) };
export function imgCached(id) { return id ? mem.get(id) || '' : ''; }
export function putImage(dataUrl) {
  const id = rid();
  mem.set(id, toUrl(dataUrl));
  idbPut(id, dataUrl);
  set('img/' + id, { d: dataUrl, by: uid, t: Date.now() }, false);
  return id;
}
export function getImage(id) {
  if (!id) return Promise.resolve('');
  if (mem.has(id)) return Promise.resolve(mem.get(id));
  if (inflight.has(id)) return inflight.get(id);
  const p = (async () => {
    let d = await idbGet(id);
    if (!d) {
      for (let i = 0; i < 3 && !d; i++) {
        try { const s = await F.getDoc(ref('img/' + id)); d = s.exists() ? s.data().d : null; if (!d) break; }
        catch (e) { await new Promise(r => setTimeout(r, 1500 * (i + 1))); }
      }
      if (d) idbPut(id, d);
    }
    inflight.delete(id);
    if (!d) return '';
    const u = toUrl(d); mem.set(id, u); return u;
  })();
  inflight.set(id, p);
  return p;
}
export function dropImage(id) { if (id) del('img/' + id); }

// Copia local del perfil propio para abrir al instante y sin conexión.
export const me = {
  get() { const m = LS.get('me'); return m && m.uid === uid ? m.p : null; },
  set(p) { LS.set('me', { uid, p }); }
};
