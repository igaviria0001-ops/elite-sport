// Utilidades comunes de Elite Sport.

// ── Almacenamiento del aparato ──────────────────────────────────────────────
// ?who=nombre separa "aparatos" en pruebas (varios usuarios en un mismo navegador).
export const WHO = (new URLSearchParams(location.search).get('who') || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 20);
const NS = 'es_' + (WHO ? WHO + '_' : '');
export const LS = {
  get(k, d = null) { try { const v = localStorage.getItem(NS + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(NS + k); } catch (e) {} }
};

// ── Texto y fechas ──────────────────────────────────────────────────────────
export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const pad = n => String(n).padStart(2, '0');
export function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
export function today() { return ymd(new Date()); }
export function dayOff(k) { const d = new Date(); d.setDate(d.getDate() + k); return ymd(d); }
export function thisMonth() { return today().slice(0, 7); }
export function parseDay(s) { const p = String(s || '').split('-'); return new Date(+p[0], (+p[1] || 1) - 1, +p[2] || 1); }
export function fmtDay(s) {
  if (!s) return '';
  const t = today(), d = parseDay(s);
  const base = d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
  if (s === t) return 'Hoy · ' + base;
  if (s === dayOff(1)) return 'Mañana · ' + base;
  return cap(base);
}
export function fmtShort(s) { return parseDay(s).toLocaleDateString('es', { day: 'numeric', month: 'short' }); }
export function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h < 12 ? 'a. m.' : 'p. m.';
  return ((h % 12) || 12) + ':' + pad(m) + ' ' + ap;
}
export function monthName(ym) {
  const [y, m] = ym.split('-').map(Number);
  return cap(new Date(y, m - 1, 1).toLocaleDateString('es', { month: 'long', year: 'numeric' }));
}
export function monthShort(m) { return ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][m - 1]; }
export function addMonth(ym, k) {
  const [y, m] = ym.split('-').map(Number), d = new Date(y, m - 1 + k, 1);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1);
}
export function ago(t) {
  if (!t) return '';
  const s = (Date.now() - t) / 1000;
  if (s < 90) return 'hace un momento';
  if (s < 3600) return 'hace ' + Math.round(s / 60) + ' min';
  if (s < 86400) return 'hace ' + Math.round(s / 3600) + ' h';
  if (s < 86400 * 30) { const d = Math.round(s / 86400); return 'hace ' + d + (d === 1 ? ' día' : ' días'); }
  return new Date(t).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
}
export function stamp(t) {
  const d = new Date(t);
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}
export function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
export function money(n) { return '$' + Math.round(+n || 0).toLocaleString('es-CO'); }
export function rid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
export function slug(s) {
  return norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'rival';
}
export function norm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
export function byName(a, b) { return String(a).localeCompare(String(b), 'es', { numeric: true, sensitivity: 'base' }); }
export function initials(name) {
  const w = String(name || '').trim().split(/\s+/).filter(Boolean);
  return ((w[0] || '?').charAt(0) + (w.length > 1 ? w[w.length - 1].charAt(0) : '')).toUpperCase();
}
export function firstName(name) { return String(name || '').trim().split(/\s+/)[0] || ''; }

// ── Nombre real del jugador ─────────────────────────────────────────────────
const PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'do', 'dos', 'van', 'von', 'di', 'le', 'mc', 'san', 'st']);
// Raíces que no pueden estar en ninguna parte del nombre (largas y sin falsos positivos).
const BAD_ANY = ['hijueputa', 'hijodeputa', 'hijuepu', 'jueputa', 'malparid', 'gonorre', 'mierd', 'carechimba', 'careverga', 'caremonda',
  'triplehijue', 'pirob', 'gonorrea', 'marihuan', 'maricon', 'mariquit', 'pendej', 'chimba', 'culiad', 'culear',
  'culiar', 'follar', 'pajer', 'fuck', 'shit', 'bitch', 'pussy', 'asshole', 'porno', 'violad', 'hitler', 'estupid',
  'imbecil', 'idiot', 'huevon', 'guevon', 'webon', 'gueva', 'hueva', 'tetas', 'vagin', 'cabron', 'cagad', 'pichurri'];
// Palabras completas prohibidas (cortas: solo si son la palabra entera).
const BAD_WORD = new Set(['puta', 'puto', 'putas', 'putos', 'hp', 'hpta', 'hptas', 'jp', 'culo', 'culos', 'pene', 'penes', 'polla', 'teta', 'coño', 'cono',
  'verga', 'vergas', 'nazi', 'caca', 'pedo', 'pedos', 'mamon', 'mamona', 'marica', 'marika', 'zorra', 'perra', 'perro', 'ass', 'dick', 'cock', 'sexo', 'sex',
  'tonto', 'tonta', 'bobo', 'boba', 'gordo', 'flaco', 'nadie', 'nada', 'nose', 'test', 'prueba', 'asdf', 'qwerty', 'admin', 'anfitrion',
  'jugador', 'usuario', 'nombre', 'apellido', 'monda', 'mondá', 'paja', 'pajas', 'chupa', 'lame', 'mamar', 'sapo', 'sapa', 'rata', 'loca', 'loco']);

function deLeet(s) {
  return s.replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't').replace(/@/g, 'a').replace(/\$/g, 's');
}
export function cleanName(raw) {
  const s = String(raw || '').replace(/\s+/g, ' ').trim();
  return s.split(' ').map(w => {
    const lw = w.toLocaleLowerCase('es');
    if (PARTICLES.has(lw)) return lw;
    return lw.split('-').map(p => p.split("'").map(q => q.charAt(0).toLocaleUpperCase('es') + q.slice(1)).join("'")).join('-');
  }).join(' ');
}
// Devuelve '' si el nombre sirve, o el motivo si no.
export function nameProblem(raw) {
  const s = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!s) return 'Escribe el nombre y el apellido del jugador.';
  if (s.length < 5) return 'Escribe el nombre completo: nombre y apellido.';
  if (s.length > 40) return 'El nombre es muy largo (máximo 40 letras).';
  if (/[0-9@#$%^&*_=+<>{}[\]|\\/~`!?¿¡:;,"()]/.test(s)) return 'Usa solo letras: sin números, símbolos ni emojis.';
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ' .-]+$/.test(s)) return 'Usa solo letras: sin números, símbolos ni emojis.';
  const words = s.split(' ').filter(Boolean);
  const real = words.filter(w => !PARTICLES.has(w.toLowerCase()) && w.replace(/[^A-Za-zÀ-ÿ]/g, '').length >= 2);
  if (real.length < 2) return 'Escribe nombre y apellido (por ejemplo: Santiago Gómez).';
  if (words.some(w => w.replace(/[.'-]/g, '').length === 1 && !PARTICLES.has(w.toLowerCase()))) return 'Escribe las palabras completas, sin iniciales sueltas.';
  const n = norm(s), flat = deLeet(n).replace(/[^a-z ]/g, '');
  const squeezed = flat.replace(/(.)\1+/g, '$1');
  for (const w of flat.split(' ').concat(squeezed.split(' '))) {
    if (BAD_WORD.has(w)) return 'Ese nombre no está permitido. Escribe el nombre real del jugador.';
    if (/(.)\1\1/.test(w)) return 'Revisa el nombre: tiene letras repetidas.';
    if (w.length >= 3 && !/[aeiouy]/.test(w)) return 'Revisa el nombre: no parece un nombre real.';
  }
  const joined = flat.replace(/ /g, ''), joinedSq = squeezed.replace(/ /g, '');
  for (const b of BAD_ANY) if (joined.includes(b) || joinedSq.includes(b)) return 'Ese nombre no está permitido. Escribe el nombre real del jugador.';
  return '';
}

// ── Imágenes ────────────────────────────────────────────────────────────────
export function loadImage(file) {
  return new Promise((ok, no) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => { ok(im); setTimeout(() => URL.revokeObjectURL(url), 1000); };
    im.onerror = () => { URL.revokeObjectURL(url); no(new Error('imagen')); };
    im.src = url;
  });
}
// Reduce una imagen a "max" px de lado y la devuelve como data URL JPEG.
export async function shrink(file, max, q = 0.82, bg = '#fff') {
  const im = await loadImage(file);
  const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k));
  const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height);
  x.imageSmoothingQuality = 'high';
  x.drawImage(im, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', q);
}
export function dataUrlToBlob(u) {
  const i = u.indexOf(','), meta = u.slice(5, i), b64 = meta.endsWith(';base64');
  const mime = meta.replace(';base64', '') || 'image/jpeg';
  const raw = b64 ? atob(u.slice(i + 1)) : decodeURIComponent(u.slice(i + 1));
  const a = new Uint8Array(raw.length);
  for (let k = 0; k < raw.length; k++) a[k] = raw.charCodeAt(k);
  return new Blob([a], { type: mime });
}

// Abre la cámara/galería con un input recién creado (lo más confiable en celulares).
export function pickFiles({ multiple = false, accept = 'image/*', capture = '' } = {}) {
  return new Promise(ok => {
    const old = document.getElementById('fpick'); if (old) old.remove();
    const n = document.createElement('input');
    n.type = 'file'; n.id = 'fpick'; n.accept = accept; n.multiple = multiple;
    if (capture) n.setAttribute('capture', capture);
    n.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0';
    document.body.appendChild(n);
    let done = false;
    const fin = files => { if (done) return; done = true; ok(files); setTimeout(() => n.remove(), 2000); };
    n.addEventListener('change', () => fin(Array.from(n.files || [])));
    n.addEventListener('cancel', () => fin([]));
    n.click();
  });
}

// ── Avisos, confirmaciones y hojas ──────────────────────────────────────────
let toastEl = null, toastT = 0;
export function toast(msg, opt = {}) {
  if (toastEl) toastEl.remove();
  clearTimeout(toastT);
  const d = document.createElement('div');
  d.className = 'toast' + (opt.ok ? ' ok' : '');
  d.setAttribute('role', 'status');
  const s = document.createElement('span'); s.textContent = msg; d.appendChild(s);
  if (opt.action) {
    const b = document.createElement('button'); b.textContent = opt.action;
    b.onclick = () => { d.remove(); toastEl = null; opt.onAction && opt.onAction(); };
    d.appendChild(b);
  }
  document.body.appendChild(d); toastEl = d;
  toastT = setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 250); if (toastEl === d) toastEl = null; }, opt.ms || 3600);
}
export function ask(msg, fn, opt = {}) {
  const o = document.createElement('div');
  o.className = 'veil';
  o.innerHTML = '<div class="card dlg" role="dialog" aria-modal="true"><div class="name dmsg"></div><div class="mute dsub"></div><div class="chips"><button data-n>Cancelar</button><button class="A on" data-y></button></div></div>';
  o.querySelector('.dmsg').textContent = msg;
  o.querySelector('.dsub').textContent = opt.sub || '';
  o.querySelector('[data-y]').textContent = opt.yes || 'Sí, borrar';
  if (opt.safe) o.querySelector('[data-y]').className = 'P on';
  const close = () => o.remove();
  o.addEventListener('click', e => { if (e.target === o) close(); });
  o.querySelector('[data-n]').onclick = close;
  o.querySelector('[data-y]').onclick = () => { close(); fn(); };
  document.body.appendChild(o);
  o.querySelector('[data-y]').focus();
}
// Hoja inferior genérica. build(el) dibuja; devuelve {el, close}.
export function sheet(html, opt = {}) {
  const o = document.createElement('div');
  o.className = 'veil sheetv';
  o.innerHTML = '<div class="sheet" role="dialog" aria-modal="true"><button class="x sx" aria-label="Cerrar" data-close>×</button><div class="sbody"></div></div>';
  o.querySelector('.sbody').innerHTML = html;
  const close = () => { o.classList.add('out'); setTimeout(() => o.remove(), 180); opt.onClose && opt.onClose(); };
  o.addEventListener('click', e => { if (e.target === o || e.target.closest('[data-close]')) close(); });
  document.body.appendChild(o);
  requestAnimationFrame(() => o.classList.add('in'));
  return { el: o, body: o.querySelector('.sbody'), close, set(h) { o.querySelector('.sbody').innerHTML = h; } };
}
export function viewImg(src) {
  const o = document.createElement('div');
  o.className = 'veil zoom';
  o.innerHTML = '<img alt="">';
  o.firstChild.src = src;
  o.onclick = () => o.remove();
  document.body.appendChild(o);
}
export function vibrate(ms = 12) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }
