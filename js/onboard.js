// Registro (foto + nombre real), recorte de foto, acceso de anfitrión y perfil.
import * as B from './backend.js';
import { R, D, cats, myPlayer, becomeHost, stopHost, cname } from './state.js';
import { LS, esc, loadImage, pickFiles, nameProblem, cleanName, toast, sheet, ask, vibrate } from './util.js';

export const OB = { photo: '', name: '', cat: '' };

// ── Recorte circular de la foto (arrastrar y acercar) ───────────────────────
export function cropImage(file, size = 320) {
  return new Promise(async done => {
    let im;
    try { im = await loadImage(file); } catch (e) { toast('No se pudo abrir esa imagen. Prueba con otra.'); return done(null); }
    const o = document.createElement('div');
    o.className = 'veil';
    o.innerHTML = `<div class="card cropper" role="dialog" aria-modal="true"><div class="name center">Ajusta tu foto</div><div class="mute center small">Arrastra para mover · usa la barra para acercar</div>
      <canvas width="600" height="600"></canvas><input type="range" min="1" max="4" step="0.01" value="1" aria-label="Acercar">
      <div class="chips"><button data-n>Cancelar</button><button class="P on" data-y>Usar foto</button></div></div>`;
    document.body.appendChild(o);
    const cv = o.querySelector('canvas'), x = cv.getContext('2d'), rg = o.querySelector('input');
    const W = 600, R0 = 270; // radio del círculo en el lienzo
    const base = (2 * R0) / Math.min(im.naturalWidth, im.naturalHeight);
    let z = 1, cx = 0, cy = 0; // desplazamiento del centro de la imagen respecto al centro
    const clampPos = () => {
      const s = base * z, hw = im.naturalWidth * s / 2, hh = im.naturalHeight * s / 2;
      cx = Math.max(R0 - hw, Math.min(hw - R0, cx)); cy = Math.max(R0 - hh, Math.min(hh - R0, cy));
    };
    const draw = () => {
      const s = base * z;
      x.fillStyle = '#111'; x.fillRect(0, 0, W, W);
      x.drawImage(im, W / 2 + cx - im.naturalWidth * s / 2, W / 2 + cy - im.naturalHeight * s / 2, im.naturalWidth * s, im.naturalHeight * s);
      x.save(); x.fillStyle = 'rgba(0,0,0,.62)'; x.beginPath(); x.rect(0, 0, W, W); x.arc(W / 2, W / 2, R0, 0, Math.PI * 2, true); x.fill('evenodd');
      x.strokeStyle = '#FFC83D'; x.lineWidth = 4; x.beginPath(); x.arc(W / 2, W / 2, R0, 0, Math.PI * 2); x.stroke(); x.restore();
    };
    draw();
    const pts = new Map(); let pinch = null;
    const scale = () => W / cv.getBoundingClientRect().width;
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z }; } });
    cv.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId), cur = { x: e.clientX, y: e.clientY };
      pts.set(e.pointerId, cur);
      if (pts.size === 2 && pinch) { const [a, b] = [...pts.values()]; z = Math.max(1, Math.min(4, pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d)); rg.value = z; }
      else { const k = scale(); cx += (cur.x - prev.x) * k; cy += (cur.y - prev.y) * k; }
      clampPos(); draw();
    });
    const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    rg.addEventListener('input', () => { z = +rg.value; clampPos(); draw(); });
    const close = v => { o.remove(); done(v); };
    o.querySelector('[data-n]').onclick = () => close(null);
    o.querySelector('[data-y]').onclick = () => {
      const out = document.createElement('canvas'); out.width = out.height = size;
      const k = size / (2 * R0), s = base * z, ox = out.getContext('2d');
      ox.fillStyle = '#fff'; ox.fillRect(0, 0, size, size); ox.imageSmoothingQuality = 'high';
      ox.drawImage(im, (W / 2 + cx - im.naturalWidth * s / 2 - (W / 2 - R0)) * k, (W / 2 + cy - im.naturalHeight * s / 2 - (W / 2 - R0)) * k, im.naturalWidth * s * k, im.naturalHeight * s * k);
      close(out.toDataURL('image/jpeg', 0.84));
    };
  });
}
// Pide foto (cámara o galería) y la recorta. El selector se abre dentro del
// mismo toque (los celulares lo exigen).
export function choosePhoto() {
  return new Promise(done => {
    const s = sheet(`<div class="name center" style="margin-bottom:12px">Foto de perfil</div><button class="btn" data-k="cam">📷 Tomar foto</button><button class="btn alt" data-k="gal" style="margin-top:8px">🖼️ Elegir de la galería</button>`, { onClose: () => done(null) });
    s.body.addEventListener('click', e => {
      const b = e.target.closest('[data-k]'); if (!b) return;
      const fp = pickFiles({ accept: 'image/*', capture: b.dataset.k === 'cam' ? 'user' : '' });
      s.el.remove();
      fp.then(fs => (fs[0] ? cropImage(fs[0]).then(done) : done(null)));
    });
  });
}

// ── Registro ────────────────────────────────────────────────────────────────
export function obInput() {
  const el = document.getElementById('ob-name'), er = document.getElementById('ob-err');
  if (!el || !er) return;
  OB.name = el.value;
  const p = el.value.trim().length >= 5 ? nameProblem(el.value) : '';
  er.textContent = p;
}
export async function obSave(render) {
  const el = document.getElementById('ob-name'), er = document.getElementById('ob-err'), sel = document.getElementById('ob-cat');
  OB.name = el ? el.value : OB.name; OB.cat = sel ? sel.value : '';
  const prob = nameProblem(OB.name);
  if (prob) { if (er) er.textContent = prob; el && el.focus(); vibrate(30); return; }
  if (!OB.photo && !R.host) { toast('Agrega una foto del jugador para entrar.'); vibrate(30); return; }
  const name = cleanName(OB.name);
  const prof = { name, t: Date.now(), last: Date.now() };
  if (OB.photo) prof.photo = B.putImage(OB.photo);
  if (OB.cat) prof.cat = OB.cat;
  R.profile = prof; B.me.set(prof); R.meReady = true;
  B.set('users/' + B.uid, prof, false);
  OB.photo = ''; OB.name = ''; OB.cat = '';
  render();
  toast('¡Listo, ' + name.split(' ')[0] + '! Tu registro quedó guardado.', { ok: true });
}

// ── Acceso de anfitrión (código con límite de intentos) ─────────────────────
const MAX_TRIES = 5, LOCKS = [15, 60, 360, 1440]; // minutos de bloqueo por ronda
function lockState() { return LS.get('lock', { n: 0, round: 0, until: 0 }); }
function lockLeft() { const l = lockState(); return Math.max(0, l.until - Date.now()); }
const mmss = ms => { const s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ' h ' : '') + (h ? String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };

export function hostModal(render) {
  if (R.host) { toast('Ya eres anfitrión en este aparato.', { ok: true }); return; }
  const o = document.createElement('div');
  o.className = 'veil';
  o.innerHTML = `<div class="card dlg hostdlg" role="dialog" aria-modal="true"><div class="hk">🔑</div><div class="name center">Acceso de anfitrión</div><div class="mute center small">Solo para quien administra el club.${B.MODE === 'local' ? ' (Modo local: el código de prueba es DEMO)' : ''}</div>
    <input id="hc" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="12" placeholder="Código" aria-label="Código de anfitrión">
    <div class="hmsg" aria-live="polite"></div><div class="chips"><button data-n>Cancelar</button><button class="P on" data-y>Entrar</button></div></div>`;
  document.body.appendChild(o);
  const inp = o.querySelector('#hc'), msg = o.querySelector('.hmsg'), yes = o.querySelector('[data-y]');
  let tick = 0, busy = false;
  const paint = () => {
    const left = lockLeft(), l = lockState();
    if (left > 0) { inp.disabled = true; yes.disabled = true; msg.className = 'hmsg bad'; msg.textContent = 'Demasiados intentos. Por seguridad, espera ' + mmss(left) + '.'; return; }
    inp.disabled = busy; yes.disabled = busy;
    if (busy) { msg.className = 'hmsg'; msg.textContent = 'Comprobando…'; return; }
    if (l.n > 0) { msg.className = 'hmsg bad'; msg.textContent = 'Código incorrecto. Te quedan ' + (MAX_TRIES - l.n) + (MAX_TRIES - l.n === 1 ? ' intento.' : ' intentos.'); }
    else { msg.className = 'hmsg'; msg.textContent = ''; }
  };
  paint(); tick = setInterval(() => { if (lockLeft() > 0 || inp.disabled) paint(); }, 1000);
  const close = () => { clearInterval(tick); o.remove(); };
  o.addEventListener('click', e => { if (e.target === o) close(); });
  o.querySelector('[data-n]').onclick = close;
  inp.addEventListener('input', () => { const p = inp.selectionStart; inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); try { inp.setSelectionRange(p, p); } catch (e) {} });
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') yes.click(); });
  setTimeout(() => inp.focus(), 50);
  yes.onclick = async () => {
    if (busy || lockLeft() > 0) return;
    const code = inp.value.trim().toUpperCase();
    if (code.length < 2) { inp.focus(); return; }
    if (!navigator.onLine) { msg.className = 'hmsg bad'; msg.textContent = 'Necesitas conexión a internet para comprobar el código.'; return; }
    busy = true; paint();
    let ok = false;
    try { ok = await B.tryHostCode(code, R.profile ? R.profile.name : ''); }
    catch (e) { busy = false; paint(); msg.className = 'hmsg bad'; msg.textContent = 'No se pudo comprobar (revisa tu conexión) e inténtalo otra vez.'; return; }
    busy = false;
    if (ok) {
      LS.set('lock', { n: 0, round: 0, until: 0 });
      close(); becomeHost(code); render(); vibrate(20);
      toast('¡Listo! Ahora eres anfitrión. No te lo volverá a pedir en este aparato.', { ok: true, ms: 4500 });
      return;
    }
    const l = lockState(); l.n++;
    if (l.n >= MAX_TRIES) { l.until = Date.now() + LOCKS[Math.min(l.round, LOCKS.length - 1)] * 60000; l.round++; l.n = 0; }
    LS.set('lock', l); vibrate([30, 40, 30]); inp.select(); paint();
  };
}

// ── Mi perfil ───────────────────────────────────────────────────────────────
export function profileSheet(render) {
  const p = R.profile || {}, mp = myPlayer();
  let newPhoto = '';
  const html = () => `<div class="center"><button class="pp has big" data-k="photo" aria-label="Cambiar foto">${newPhoto ? `<img src="${newPhoto}" alt="">` : p.photo ? `<img src="${B.imgCached(p.photo) || ''}" data-img="${esc(p.photo)}" alt="">` : '<span class="cam">📷</span>'}</button><div class="mute small">Toca la foto para cambiarla</div></div>
    <label class="lbl" for="pf-name">Nombre y apellido</label><input id="pf-name" maxlength="40" autocapitalize="words" value="${esc(p.name || '')}"><div class="err" id="pf-err"></div>
    ${mp ? `<div class="mute" style="margin-top:8px">En el plantel: <b>${esc(mp.name)}</b> · ${esc(cname(mp.cat) || 'sin categoría')}</div>` : !R.host && cats().length ? `<label class="lbl" for="pf-cat">Categoría</label><select id="pf-cat"><option value="">Sin elegir</option>${cats().map(c => `<option value="${c.id}"${c.id === p.cat ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select>` : ''}
    <button class="btn" data-k="save" style="margin-top:14px">Guardar cambios</button>
    <div class="pfrole">${R.host ? '<div><b class="gold">Eres anfitrión</b> en este aparato.</div><button class="btn alt sm" data-k="backup" style="margin:8px 0 2px">📦 Descargar copia de seguridad</button><button class="lnk" data-k="leave">Dejar de ser anfitrión</button>' : '<button class="lnk" data-k="host">Acceso de anfitrión</button>'}</div>
    <div class="mute small center">${B.MODE === 'firebase' ? 'Tus datos están guardados en el servidor del club y en este aparato.' : 'Modo local: los datos solo están en este aparato.'}</div>`;
  const s = sheet(html());
  const hydr = () => s.body.querySelectorAll('img[data-img]:not([src]),img[data-img][src=""]').forEach(el => B.getImage(el.dataset.img).then(u => { if (u) el.src = u; }));
  hydr();
  s.body.addEventListener('click', async e => {
    const b = e.target.closest('[data-k]'); if (!b) return;
    const k = b.dataset.k;
    if (k === 'photo') { const u = await choosePhoto(); if (u) { newPhoto = u; const nm = s.body.querySelector('#pf-name').value; s.set(html()); s.body.querySelector('#pf-name').value = nm; } }
    else if (k === 'host') { s.close(); hostModal(render); }
    else if (k === 'backup') {
      b.disabled = true; b.textContent = 'Preparando…';
      try {
        const cols = ['cats', 'players', 'matches', 'rivals', 'train', 'kits', 'users', 'att', 'pay', 'log'], data = { app: 'Elite Sport', fecha: new Date().toISOString() };
        for (const c of cols) data[c] = await B.getAll(c);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
        a.download = 'elite-sport-copia-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
        toast('Copia descargada (sin las fotos).', { ok: true });
      } catch (e) { toast('No se pudo preparar la copia. Revisa tu conexión.'); }
      b.disabled = false; b.textContent = '📦 Descargar copia de seguridad';
    }
    else if (k === 'leave') {
      ask('¿Dejar de ser anfitrión?', async () => {
        s.close();
        B.del(`hostkeys/${R.key}/members/${B.uid}`);
        stopHost(); render(); toast('Ya no eres anfitrión en este aparato.');
      }, { yes: 'Sí, dejar', sub: 'Para volver a serlo tendrás que escribir el código otra vez.' });
    }
    else if (k === 'save') {
      const nm = s.body.querySelector('#pf-name').value, er = s.body.querySelector('#pf-err'), pc = s.body.querySelector('#pf-cat');
      const prob = nameProblem(nm);
      if (prob) { er.textContent = prob; return; }
      const upd = Object.assign({}, R.profile, { name: cleanName(nm) });
      if (newPhoto) upd.photo = B.putImage(newPhoto);
      if (pc) { if (pc.value) upd.cat = pc.value; else delete upd.cat; }
      R.profile = upd; B.me.set(upd);
      const data = { name: upd.name, photo: upd.photo || null, last: Date.now() };
      if (pc) data.cat = pc.value || B.DEL();
      B.set('users/' + B.uid, data);
      s.close(); render(); toast('Perfil actualizado.', { ok: true });
    }
  });
}
