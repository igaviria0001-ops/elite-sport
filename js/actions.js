// Acciones: lo que pasa al tocar o cambiar algo. Todo se escribe en el servidor
// (Firestore) y la pantalla se actualiza sola cuando llega el cambio.
import * as B from './backend.js';
import { D, U, R, cats, C, P, cname, players, playersByName, myName, userOf, photoOf, pendingUsers, feeOf, paidOf, attId, syncSubs, stopHost, playerOfUser, list, eraseOps, dueDay, isFree, telOf, remOf } from './state.js';
import { FT, POS, TYPES, slots, OBM, yearGrid, getDefer, isApp, av, uav, pendingPay, kitChoosers } from './views.js';
import { OB, choosePhoto, obInput, obSave, hostModal, profileSheet } from './onboard.js';
import { LS, esc, rid, today, thisMonth, addMonth, monthName, monthOnly, cap, money, fmtShort, phoneNorm, phoneShow, waLink, slug, cleanName, nameProblem, shrink, pickFiles, toast, ask, sheet, viewImg, vibrate, byName, norm, ymd, parseDay } from './util.js';

let render = () => {};
export let sheetRefresh = null;
export function bindActions(r) { render = r; }

const val = id => { const e = document.getElementById(id); return e ? e.value.trim() : ''; };
const clear = (...ids) => ids.forEach(id => { const e = document.getElementById(id); if (e) e.value = e.tagName === 'SELECT' ? (e.options[0] ? e.options[0].value : '') : ''; });
function log(x) { B.set('log/' + rid(), { t: Date.now(), w: myName(), u: B.uid, x }, false); }
const hostOnly = () => { if (!R.host) { toast('Solo un anfitrión puede hacer cambios.'); return false; } return true; };

function go(tab) {
  U.tab = tab; U.cat = null; U.slot = null; U.editMatch = null; U.editTrain = null; OBM.crest = '';
  LS.set('tab', tab);
  if (tab === 'lista' && !U.lcat) { const c = cats()[0]; U.lcat = c ? c.id : ''; }
  syncSubs(); render(); scrollTo(0, 0);
  const b = document.querySelector(`#nav [data-tab="${tab}"]`); b && b.scrollIntoView({ inline: 'center', block: 'nearest' });
}

// ── Clics ───────────────────────────────────────────────────────────────────
document.addEventListener('click', e => {
  const t = e.target.closest('[data-tab],[data-act],[data-go]');
  if (!t || t.closest('.sheet') || t.closest('.dlg') || t.closest('.cropper')) return;
  if (t.dataset.tab) return go(t.dataset.tab);
  if (t.dataset.go) return go(t.dataset.go);
  const a = t.dataset.act, id = t.dataset.id;
  const fn = ACT[a];
  if (fn) fn(t, id, e);
});

const ACT = {
  retry: () => location.reload(),
  repair: async () => {
    // Borra solo la copia de los archivos de la app (nunca datos ni sesión) y recarga.
    try { for (const k of await caches.keys()) if (/^(elite-sport-|es-v\d)/.test(k)) await caches.delete(k); } catch (e) {}
    location.reload();
  },
  hostkey: () => hostModal(render),
  profile: () => profileSheet(render),
  'ob-photo': async () => { const u = await choosePhoto(); if (u) { OB.photo = u; render(); } },
  'ob-save': () => obSave(render),
  install: () => {
    const d = getDefer();
    if (d) { d.prompt(); d.userChoice && d.userChoice.then(() => render()); return; }
    const ua = navigator.userAgent, ios = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const inApp = /FBAN|FBAV|Instagram|WhatsApp|Line\/|; wv\)|GSA\//i.test(ua);
    const url = location.href.split('?')[0].split('#')[0];
    sheet(`<div class="name center">Instalar Elite Independiente</div>${inApp ? `<div class="card note" style="margin-top:10px">Estás viendo la app dentro de otra aplicación. Primero ábrela en ${ios ? '<b>Safari</b>' : '<b>Chrome</b>'}: toca los tres puntos o el botón de compartir y elige «Abrir en el navegador». Dirección: <b>${esc(url)}</b></div>` : ''}<ol class="steps">${ios
      ? '<li>Abre la app en <b>Safari</b>.</li><li>Toca el botón <b>Compartir</b> (cuadro con flecha hacia arriba).</li><li>Elige <b>Agregar a pantalla de inicio</b> y luego <b>Agregar</b>.</li>'
      : '<li>Abre la app en <b>Chrome</b>. Si arriba a la izquierda ves una <b>✕</b>, estás dentro de otra app: toca los tres puntos y elige <b>Abrir en Chrome</b>.</li><li>Toca los <b>tres puntos</b> (arriba a la derecha).</li><li>Elige <b>Instalar app</b>, o «Agregar a la pantalla principal» y luego <b>Instalar</b> (no «Crear acceso directo»).</li>'}</ol><div class="mute small">Queda como una app más, con el escudo del club. Tu sesión y tus datos se conservan al instalarla.</div>`);
  },

  // Categorías
  opencat: (t, id) => { U.tab = 'cats'; U.cat = id; U.slot = null; LS.set('tab', 'cats'); render(); scrollTo(0, 0); },
  back: () => { U.cat = null; U.slot = null; render(); },
  addcat: () => {
    if (!hostOnly()) return;
    const v = val('cn');
    if (!v) { document.getElementById('cn').focus(); return; }
    if (cats().some(c => norm(c.name) === norm(v))) { toast('Ya existe una categoría con ese nombre.'); return; }
    const id = rid();
    B.set('cats/' + id, { name: v, fmt: 'Fútbol 11', form: '4-4-2', lineup: {}, t: Date.now() }, false);
    log('Categoría creada: ' + v); clear('cn'); render();
  },
  rencat: (t, id) => {
    const c = C(id); if (!c) return;
    const s = sheet(`<div class="name">Nombre de la categoría</div><input id="rn" maxlength="30" value="${esc(c.name)}" style="margin:10px 0"><button class="btn" data-k="ok">Guardar</button>`);
    s.body.querySelector('[data-k]').onclick = () => {
      const v = s.body.querySelector('#rn').value.trim(); if (!v) return;
      B.update('cats/' + id, { name: v }); log('Categoría renombrada: ' + c.name + ' → ' + v); s.close();
    };
  },
  delcat: (t, id) => {
    const c = C(id); if (!c) return;
    const ps = players(id);
    ask('¿Borrar la categoría ' + c.name + '?', () => {
      const ops = [['del', 'cats/' + id]];
      ps.forEach(p => { ops.push(['del', 'players/' + p.id]); ops.push(['del', 'pay/' + p.id]); });
      B.batch(ops); log('Categoría borrada: ' + c.name); U.cat = null; render();
    }, { sub: ps.length ? `También se borrarán sus ${ps.length} jugadores y sus pagos.` : '' });
  },
  slot: (t) => { const i = +t.dataset.i; U.slot = U.slot === i ? null : i; render(); },
  closeslot: () => { U.slot = null; render(); },
  put: (t, id) => {
    const c = C(U.cat); if (!c || U.slot === null) return;
    const upd = { ['lineup.' + U.slot]: id };
    Object.keys(c.lineup || {}).forEach(k => { if (c.lineup[k] === id && +k !== U.slot) upd['lineup.' + k] = B.DEL(); });
    B.update('cats/' + c.id, upd); U.slot = null; render();
  },
  clearslot: () => { const c = C(U.cat); if (!c) return; B.update('cats/' + c.id, { ['lineup.' + U.slot]: B.DEL() }); U.slot = null; render(); },
  addplayer: () => {
    if (!hostOnly()) return;
    const n = val('pn'), num = val('pm').replace(/\D/g, '').slice(0, 3), pos = val('pp');
    if (!n) { document.getElementById('pn').focus(); return; }
    const prob = nameProblem(n);
    if (prob) { toast(prob); return; }
    B.set('players/' + rid(), { name: cleanName(n), num, pos, cat: U.cat, t: Date.now() }, false);
    log('Jugador agregado: ' + cleanName(n) + ' (' + cname(U.cat) + ')'); clear('pn', 'pm'); render();
    setTimeout(() => { const e = document.getElementById('pn'); e && e.focus(); }, 30);
  },
  editplayer: (t, id) => playerSheet(id),

  // Personas
  pseg: (t, id) => { U.personas = id; render(); },
  approve: (t, id) => approveSheet(id),
  linkto: (t, id) => link(id, t.dataset.p),
  linkuser: (t, id) => linkSheet(id),
  notplayer: (t, id) => { B.update('users/' + id, { np: true }); toast('Listo: no aparecerá como jugador pendiente.', { ok: true, action: 'Deshacer', onAction: () => B.update('users/' + id, { np: B.DEL() }) }); },
  person: (t, id) => personSheet(id),
  unhost: (t, id) => {
    const u = D.users[id], me = id === B.uid;
    ask(me ? '¿Dejar de ser anfitrión?' : '¿Quitarle el rol de anfitrión a ' + ((u && u.name) || 'esta persona') + '?', () => {
      B.del(`hostkeys/${R.key}/members/${id}`);
      if (me) { stopHost(); go('inicio'); toast('Ya no eres anfitrión en este aparato.'); }
      else { log('Quitó anfitrión: ' + ((u && u.name) || '')); toast('Rol de anfitrión quitado.', { ok: true }); }
    }, { yes: me ? 'Sí, dejar' : 'Sí, quitar', sub: 'Para volver a ser anfitrión tendrá que escribir el código.' });
  },

  // Partidos
  fcat: (t, id) => { U.fcat = id; LS.set('fcat', id); render(); },
  mcrest: () => { pickFiles({ accept: 'image/*' }).then(async fs => { if (!fs[0]) return; try { OBM.crest = await shrink(fs[0], 200, 0.86); render(); } catch (e) { toast('No se pudo abrir esa imagen.'); } }); },
  crest: (t) => {
    const name = t.dataset.name;
    pickFiles({ accept: 'image/*' }).then(async fs => {
      if (!fs[0]) return;
      try { const d = await shrink(fs[0], 200, 0.86); B.set('rivals/' + slug(name), { name, img: B.putImage(d) }, false); log('Escudo de ' + name); }
      catch (e) { toast('No se pudo abrir esa imagen.'); }
    });
  },
  savematch: () => {
    if (!hostOnly()) return;
    const rival = val('mr');
    if (!rival) { document.getElementById('mr').focus(); toast('Escribe el nombre del rival.'); return; }
    const date = val('md') || today();
    const m = { rival, place: val('mp'), date, time: val('mt'), cat: val('mc'), kit: val('mk') };
    if (OBM.crest) B.set('rivals/' + slug(rival), { name: rival, img: B.putImage(OBM.crest) }, false);
    if (U.editMatch && D.matches[U.editMatch]) { B.update('matches/' + U.editMatch, m); log('Partido editado: vs ' + rival); toast('Partido actualizado.', { ok: true }); }
    else { m.res = ''; m.t = Date.now(); B.set('matches/' + rid(), m, false); log('Partido agregado: vs ' + rival); toast('Partido guardado. Ya lo ven todos.', { ok: true }); }
    U.editMatch = null; OBM.crest = ''; clear('mr', 'mp', 'mt', 'mk'); render();
  },
  editmatch: (t, id) => { U.editMatch = id; OBM.crest = ''; ['mr', 'mp', 'md', 'mt', 'mc', 'mk'].forEach(k => { const e = document.getElementById(k); if (e) e.removeAttribute('id'); }); render(); scrollTo({ top: 0, behavior: 'smooth' }); },
  canceledit: () => { U.editMatch = null; U.editTrain = null; OBM.crest = ''; ['mr', 'mp', 'md', 'mt', 'mc', 'mk', 'td', 'tt', 'tp', 'tc', 'ty', 'tn'].forEach(k => { const e = document.getElementById(k); if (e) e.removeAttribute('id'); }); render(); },
  delmatch: (t, id) => { const m = D.matches[id]; ask('¿Borrar el partido vs ' + (m ? m.rival : '') + '?', () => { B.del('matches/' + id); log('Partido borrado: vs ' + (m ? m.rival : '')); if (U.editMatch === id) U.editMatch = null; }); },

  // Entrenamientos
  savetrain: () => {
    if (!hostOnly()) return;
    const x = { date: val('td') || today(), time: val('tt'), place: val('tp'), cat: val('tc'), type: val('ty') || 'Técnico', note: val('tn') };
    if (U.editTrain && D.train[U.editTrain]) { B.update('train/' + U.editTrain, x); log('Entrenamiento editado (' + x.date + ')'); toast('Entrenamiento actualizado.', { ok: true }); }
    else {
      const n = Math.max(1, Math.min(12, +val('tr') || 1)), ops = [];
      for (let i = 0; i < n; i++) { const d = parseDay(x.date); d.setDate(d.getDate() + 7 * i); ops.push(['set', 'train/' + rid() + i, Object.assign({}, x, { date: ymd(d), photos: [], t: Date.now() }), false]); }
      B.batch(ops); log(n > 1 ? `Entrenamientos programados: ${n} semanas desde ${x.date}` : 'Entrenamiento programado: ' + x.date);
      toast(n > 1 ? `Se programaron ${n} entrenamientos.` : 'Entrenamiento guardado. Ya lo ven todos.', { ok: true });
    }
    U.editTrain = null; clear('tt', 'tp', 'tn', 'tr'); render();
  },
  edittrain: (t, id) => { U.editTrain = id; ['td', 'tt', 'tp', 'tc', 'ty', 'tn'].forEach(k => { const e = document.getElementById(k); if (e) e.removeAttribute('id'); }); render(); scrollTo({ top: 0, behavior: 'smooth' }); },
  deltrain: (t, id) => {
    const x = D.train[id];
    ask('¿Borrar este entrenamiento?', () => {
      B.del('train/' + id); (x && x.photos || []).forEach(p => { B.dropImage(p.th); B.dropImage(p.full); });
      log('Entrenamiento borrado (' + (x ? x.date : '') + ')');
    }, { sub: x && x.photos && x.photos.length ? 'También se borrarán sus fotos.' : '' });
  },
  morepast: () => { U.pastN += 10; render(); },
  trainphotos: (t, id) => {
    pickFiles({ accept: 'image/*', multiple: true }).then(async fs => {
      if (!fs.length) return;
      const k = Math.min(fs.length, 12);
      toast('Subiendo ' + k + (k === 1 ? ' foto…' : ' fotos…'), { ok: true, ms: 8000 });
      let ok = 0;
      for (const f of fs.slice(0, 12)) {
        try {
          const th = await shrink(f, 360, 0.72), full = await shrink(f, 1280, 0.8);
          B.update('train/' + id, { photos: B.UNION({ th: B.putImage(th), full: B.putImage(full) }) }); ok++;
        } catch (e) {}
      }
      log('Fotos de entrenamiento: ' + ok);
      toast(ok ? (ok === 1 ? 'Foto agregada.' : ok + ' fotos agregadas.') : 'No se pudieron abrir las fotos.', { ok: !!ok });
    });
  },
  viewphoto: (t, id) => {
    const x = D.train[id], p = x && (x.photos || [])[+t.dataset.i];
    if (!p) return;
    const o = document.createElement('div');
    o.className = 'veil zoom';
    o.innerHTML = `<img alt="Foto del entrenamiento" src="${B.imgCached(p.full) || B.imgCached(p.th) || ''}">${R.host ? '<button class="btn alt zdel">Borrar foto</button>' : ''}`;
    const im = o.querySelector('img');
    B.getImage(p.full).then(u => { if (u) im.src = u; });
    o.onclick = e => {
      if (e.target.closest('.zdel')) { ask('¿Borrar esta foto?', () => { B.update('train/' + id, { photos: B.REMOVE(p) }); B.dropImage(p.th); B.dropImage(p.full); }); }
      o.remove();
    };
    document.body.appendChild(o);
  },

  // Asistencia
  mark: (t, id) => {
    if (!hostOnly()) return;
    const cur = D.att && D.att.m && D.att.m[id], v = t.dataset.v;
    B.set('att/' + attId(), { date: U.date, kind: U.kind, cat: U.lcat, m: { [id]: cur === v ? B.DEL() : v } });
    vibrate(8);
  },
  allP: () => { const m = {}; players(U.lcat).forEach(p => { m[p.id] = 'P'; }); B.set('att/' + attId(), { date: U.date, kind: U.kind, cat: U.lcat, m }); },
  allClear: () => ask('¿Borrar las marcas de este día?', () => B.set('att/' + attId(), { date: U.date, kind: U.kind, cat: U.lcat, m: {} }, false), { yes: 'Sí, limpiar' }),

  // Pagos
  mprev: () => { U.month = addMonth(U.month, -1); render(); },
  mnext: () => { U.month = addMonth(U.month, 1); render(); },
  pcat: (t, id) => { U.pcat = id; render(); },
  pay: (t, id) => togglePay(id, U.month),
  payhist: (t, id) => payHistSheet(id),
  savetel: () => {
    const e = document.getElementById('tc-tel'), t = phoneNorm(e ? e.value : '');
    if (!t) { const er = document.getElementById('tc-err'); if (er) er.textContent = 'Escribe un celular válido (10 dígitos, por ejemplo 300 123 4567).'; return; }
    D.myTel = t; e.value = ''; B.setQuiet('tels/' + B.uid, { tel: t, t: Date.now() }); render(); toast('¡Gracias! Número guardado.', { ok: true });
  },
  remind: () => remindSheet(U.tab === 'pagos' ? U.month : thisMonth()),
  wa1: (t, id) => { const p = P(id); if (p) sendOne(p, U.month); },
  freemonth: () => {
    const ym = U.month, f = isFree(ym), mes = monthOnly(ym);
    ask(f ? `¿Sí se cobra ${mes}?` : `¿${cap(mes)} no se cobra?`, () => {
      B.set('club/main', { free: { [ym]: f ? B.DEL() : true } });
      log((f ? 'Se cobra ' : 'No se cobra ') + monthName(ym).toLowerCase());
    }, { yes: f ? 'Sí, se cobra' : 'No se cobra', safe: true, sub: f ? 'Los que no hayan pagado volverán a aparecer como pendientes.' : 'Nadie aparecerá con ese mes pendiente ni recibirá recordatorios de ese mes.' });
  },

  // Uniformes
  pickkit: async (t, id) => {
    if (!R.profile || R.profile.kit === id) return;
    const prev = R.profile.kit;
    R.profile = Object.assign({}, R.profile, { kit: id }); B.me.set(R.profile); render(); vibrate(12);
    try { await B.setQuiet('users/' + B.uid, { kit: id }); toast('Elegiste el uniforme ' + (id === 'red' ? 'rojo' : 'negro') + ' ✓', { ok: true }); }
    catch (e) {
      R.profile = Object.assign({}, R.profile); if (prev) R.profile.kit = prev; else delete R.profile.kit; B.me.set(R.profile); render();
      toast(e && e.code === 'permission-denied' ? 'Todavía no se puede guardar: falta que el anfitrión actualice la app.' : 'No se pudo guardar. Revisa tu conexión.');
    }
  },
  kitwho: (t, id) => {
    const nm = id === 'red' ? 'rojo' : 'negro', ch = kitChoosers(id).sort((a, b) => byName(a.name, b.name));
    const none = list(D.users).filter(u => !u.kit && !D.hosts[u.id]).length;
    const cat = u => { const p = playerOfUser(u.id); return p ? cname(p.cat) : 'Sin plantel'; };
    sheet(`<div class="name" style="font-size:19px">Uniforme ${nm} · ${ch.length} ${ch.length === 1 ? 'persona' : 'personas'}</div>
      <div class="rlist">${ch.length ? ch.map(u => `<div class="rrow2 row">${uav(u)}<div class="grow"><div class="name">${esc(u.name)}</div><div class="mute">${esc(cat(u))}</div></div></div>`).join('') : '<div class="empty">Nadie lo ha elegido todavía.</div>'}</div>
      ${none ? `<div class="mute small center" style="margin-top:10px">${none} ${none === 1 ? 'persona no ha' : 'personas no han'} elegido uniforme.</div>` : ''}`);
    hydrate(document.querySelector('.sheet:last-of-type') || document.body);
  },
  viewkit: (t, id) => { const k = D.kits[id]; const u = k && k.img ? B.imgCached(k.img) : 'assets/uniforme-' + (id === 'red' ? 'rojo' : 'negro') + '.jpg'; if (u) viewImg(u); else B.getImage(k.img).then(x => x && viewImg(x)); },
  kitphoto: (t, id) => {
    pickFiles({ accept: 'image/*' }).then(async fs => {
      if (!fs[0]) return;
      try { const d = await shrink(fs[0], 900, 0.82, '#111'); const old = D.kits[id] && D.kits[id].img; B.set('kits/' + id, { img: B.putImage(d) }, false); B.dropImage(old); log('Foto del uniforme ' + (id === 'red' ? 'rojo' : 'negro')); toast('Foto del uniforme actualizada.', { ok: true }); }
      catch (e) { toast('No se pudo abrir esa imagen.'); }
    });
  }
};

// ── Pagos ───────────────────────────────────────────────────────────────────
function togglePay(pid, ym, quiet) {
  if (!hostOnly()) return;
  const p = P(pid); if (!p) return;
  const was = paidOf(pid, ym);
  if (was) B.set('pay/' + pid, { m: { [ym]: B.DEL() } });
  else B.set('pay/' + pid, { m: { [ym]: { t: Date.now(), by: myName(), v: feeOf(p.cat) || 0 } } });
  log((was ? 'Quitó pago: ' : 'Pagó: ') + p.name + ' (' + monthName(ym).toLowerCase() + ')');
  vibrate(10);
  if (!quiet) toast(was ? p.name + ': pendiente.' : p.name + ': pagó ✓', { ok: !was, action: 'Deshacer', onAction: () => {
    if (was) B.set('pay/' + pid, { m: { [ym]: was } }); else B.set('pay/' + pid, { m: { [ym]: B.DEL() } });
  } });
}
function payHistSheet(pid) {
  const p = P(pid); if (!p) return;
  let y = U.month.slice(0, 4);
  const html = () => {
    const q = P(pid); if (!q) return '<div class="empty">El jugador ya no existe.</div>';
    const n = Array.from({ length: 12 }, (_, i) => paidOf(pid, y + '-' + String(i + 1).padStart(2, '0'))).filter(Boolean).length;
    return `<div class="row">${av(q)}<div class="grow"><div class="name">${esc(q.name)}</div><div class="mute">${esc(cname(q.cat))}${feeOf(q.cat) ? ' · cuota ' + '$' + feeOf(q.cat).toLocaleString('es-CO') : ''}</div></div></div>
      <div class="monthbar sm"><button data-k="yp" aria-label="Año anterior">‹</button><div class="mlabel">${y}</div><button data-k="yn" aria-label="Año siguiente">›</button></div>
      ${yearGrid(q, y, true)}<div class="mute small center">${n} ${n === 1 ? 'mes pagado' : 'meses pagados'} en ${y} · toca un mes para cambiarlo<br>– = antes de entrar al club</div>`;
  };
  const s = sheet(html(), { onClose: () => { sheetRefresh = null; } });
  sheetRefresh = () => { s.set(html()); hydrate(s.body); };
  hydrate(s.body);
  s.body.addEventListener('click', e => {
    const b = e.target.closest('[data-k],[data-act="payym"]'); if (!b) return;
    if (b.dataset.k === 'yp') { y = String(+y - 1); sheetRefresh(); }
    else if (b.dataset.k === 'yn') { y = String(+y + 1); sheetRefresh(); }
    else togglePay(pid, b.dataset.ym, true);
  });
}
export function hydrate(root) {
  root.querySelectorAll('img[data-img]').forEach(el => { if (!el.getAttribute('src')) B.getImage(el.dataset.img).then(u => { if (u && el.isConnected) el.src = u; }); });
}

// ── Recordatorios de pago por WhatsApp ──────────────────────────────────────
// WhatsApp no permite que una app gratis envíe mensajes sola: se abre el chat del
// acudiente con el mensaje ya escrito y el anfitrión solo toca «Enviar».
export const DEF_MSG = 'Hola 👋 Te recordamos el pago de la cuota de {mes} de *{jugador}* en Elite Independiente{valor}. El plazo es hasta el {fecha}. Si ya pagaste, ignora este mensaje. ¡Gracias! ⚽';
export function remText(p, ym, tpl) {
  const fee = feeOf(p.cat);
  return String(tpl || (D.club && D.club.msg) || DEF_MSG)
    .replace(/\{jugador\}/g, p.name).replace(/\{mes\}/g, monthOnly(ym))
    .replace(/\{valor\}/g, fee ? ' (' + money(fee) + ')' : '')
    .replace(/\{fecha\}/g, dueDay() + ' de ' + monthOnly(ym));
}
function openWa(url) { const w = window.open(url, '_blank'); if (!w) location.href = url; }
function groupSend(ym) {
  const ps = pendingPay(ym).sort((a, b) => byName(cname(a.cat), cname(b.cat)) || byName(a.name, b.name));
  const txt = `⚽ *Elite Independiente* · Cuota de ${monthOnly(ym)}\nPlazo: hasta el ${dueDay()} de ${monthOnly(ym)}\n\n` +
    (ps.length ? `Pendientes (${ps.length}):\n` + ps.map(p => `• ${p.name} (${cname(p.cat)})${feeOf(p.cat) ? ' — ' + money(feeOf(p.cat)) : ''}`).join('\n') + '\n\nSi ya pagaste, avísale al anfitrión para registrarlo. ¡Gracias!' : '¡Todos están al día! 🎉');
  if (navigator.share) navigator.share({ text: txt }).catch(() => {});
  else openWa(waLink('', txt));
}
function sendOne(p, ym, tel) {
  if (!hostOnly()) return;
  tel = tel || telOf(p.id);
  if (!tel) { phoneSheet(p.id, t => sendOne(p, ym, t)); return; }
  openWa(waLink(tel, remText(p, ym)));
  B.set('pay/' + p.id, { rem: { [ym]: Date.now() } });
  toast('Se abrió WhatsApp con el mensaje para ' + p.name + ': toca Enviar.', { ok: true, ms: 5000 });
}
function phoneSheet(pid, after) {
  const p = P(pid); if (!p) return;
  const s = sheet(`<div class="name">WhatsApp del acudiente</div><div class="mute small">${esc(p.name)} · número de quien paga la cuota (papá, mamá o el mismo jugador).</div>
    <input id="tel" type="tel" inputmode="tel" autocomplete="tel" placeholder="Ej. 300 123 4567" value="${esc(phoneShow(telOf(pid)))}" style="margin:12px 0 4px"><div class="err" id="tel-err"></div>
    <button class="btn" data-k="ok" style="margin-top:10px">${after ? 'Guardar y abrir WhatsApp' : 'Guardar'}</button>`);
  setTimeout(() => { const e = s.body.querySelector('#tel'); e && e.focus(); }, 80);
  s.body.querySelector('[data-k=ok]').onclick = () => {
    const t = phoneNorm(s.body.querySelector('#tel').value);
    if (!t) { s.body.querySelector('#tel-err').textContent = 'Escribe un celular válido (10 dígitos, por ejemplo 300 123 4567).'; return; }
    B.set('pay/' + pid, { tel: t, telT: Date.now() }); s.close();
    if (after) after(t); else toast('Número guardado.', { ok: true });
  };
}
function msgSheet() {
  const cur = (D.club && D.club.msg) || DEF_MSG, ex = players()[0] || { name: 'Santiago Gómez', cat: '' };
  const s = sheet(`<div class="name">Mensaje de recordatorio</div><div class="mute small" style="margin:4px 0 8px">Se reemplaza solo: <b>{jugador}</b> nombre, <b>{mes}</b> mes, <b>{valor}</b> cuota, <b>{fecha}</b> plazo. Los *asteriscos* ponen negrita en WhatsApp.</div>
    <textarea id="msg" rows="5" maxlength="600">${esc(cur)}</textarea><div class="mute small">Así se verá:</div><div class="tnote" id="prev"></div>
    <button class="btn" data-k="ok" style="margin-top:10px">Guardar mensaje</button><button class="btn alt" data-k="def" style="margin-top:8px">Volver al mensaje original</button>`);
  const ta = s.body.querySelector('#msg'), pv = s.body.querySelector('#prev');
  const paint = () => { pv.textContent = remText(ex, thisMonth(), ta.value); };
  paint(); ta.addEventListener('input', paint);
  s.body.querySelector('[data-k=ok]').onclick = () => { const v = ta.value.trim(); if (!v) return; B.set('club/main', { msg: v }); s.close(); toast('Mensaje guardado.', { ok: true }); };
  s.body.querySelector('[data-k=def]').onclick = () => { ta.value = DEF_MSG; paint(); };
}
function remindSheet(ym) {
  const row = p => {
    const tel = telOf(p.id), rem = remOf(p.id, ym);
    return `<div class="rrow2 row">${av(p)}<div class="grow"><div class="name">${esc(p.name)}</div><div class="mute">${esc(cname(p.cat))} · ${tel ? esc(phoneShow(tel)) : '<span class="noc">sin número</span>'}${rem ? ' · <span class="okc">✓ recordado ' + esc(fmtShort(ymdOf(rem))) + '</span>' : ''}</div></div>${tel ? `<button class="btn sm${rem ? ' alt' : ' wa'}" data-k="one" data-p="${p.id}">${rem ? 'Otra vez' : 'Enviar'}</button>` : `<button class="btn alt sm" data-k="tel" data-p="${p.id}">+ Número</button>`}</div>`;
  };
  const html = () => {
    const pend = pendingPay(ym).sort((a, b) => byName(cname(a.cat), cname(b.cat)) || byName(a.name, b.name));
    const withTel = pend.filter(p => telOf(p.id)), todo = withTel.filter(p => !remOf(p.id, ym)), next = todo[0];
    return `<div class="name" style="font-size:19px">Recordar pagos · ${esc(monthName(ym))}</div>
      <div class="row" style="margin:10px 0 12px"><span class="grow mute">Plazo de pago: hasta el día</span><select id="rm-due" style="width:86px">${Array.from({ length: 28 }, (_, i) => `<option${i + 1 === dueDay() ? ' selected' : ''}>${i + 1}</option>`).join('')}</select></div>
      ${isFree(ym) ? '<div class="card note">Este mes no se cobra.</div>' : !pend.length ? '<div class="empty">¡Todos están al día! 🎉</div>' : `
      <button class="btn wa" data-k="group">📢 Enviar al grupo del club (${pend.length} ${pend.length === 1 ? 'pendiente' : 'pendientes'})</button>
      <div class="mute small center" style="margin:6px 0 2px">Elige <b>WhatsApp</b> y luego el <b>grupo</b> del club (sale arriba en tus chats recientes).</div>
      <div class="sh">Mensaje a cada acudiente</div>
      ${next ? `<button class="btn" data-k="one" data-p="${next.id}">▶ Enviar a ${esc(next.name)} <span class="small">(${withTel.length - todo.length + 1} de ${withTel.length})</span></button><div class="mute small center" style="margin:6px 0 2px">Se abre WhatsApp con el mensaje listo: toca Enviar y vuelve aquí para el siguiente.</div>` : withTel.length ? '<div class="okline">✓ Ya se le recordó a todos los que tienen número.</div>' : '<div class="mute small">Agrega el WhatsApp de cada acudiente para mandarle su mensaje.</div>'}
      <div class="rlist">${pend.map(row).join('')}</div>`}
      <button class="lnk" data-k="msg" style="margin-top:12px">✎ Editar el mensaje</button>
      <div class="mute small" style="margin-top:6px">WhatsApp no deja que una app envíe mensajes sola: se abre el chat con el mensaje escrito y tú solo tocas Enviar.</div>`;
  };
  const s = sheet(html(), { onClose: () => { sheetRefresh = null; } });
  sheetRefresh = () => { const y = s.el.querySelector('.sheet').scrollTop; s.set(html()); hydrate(s.body); s.el.querySelector('.sheet').scrollTop = y; };
  hydrate(s.body);
  s.body.addEventListener('click', e => {
    const b = e.target.closest('[data-k]'); if (!b) return;
    const k = b.dataset.k, p = P(b.dataset.p);
    if (k === 'group') groupSend(ym);
    else if (k === 'one' && p) sendOne(p, ym);
    else if (k === 'tel' && p) phoneSheet(p.id);
    else if (k === 'msg') msgSheet();
  });
  s.body.addEventListener('change', e => { if (e.target.id === 'rm-due') { B.set('club/main', { due: +e.target.value }); log('Plazo de pago: hasta el día ' + e.target.value); } });
}
const ymdOf = t => ymd(new Date(t));

// ── Plantel y personas ──────────────────────────────────────────────────────
function playerSheet(pid) {
  const p = P(pid); if (!p) return;
  let photo = null; // null = sin cambio, '' = quitar, dataURL = nueva
  const u = userOf(p);
  const html = () => `<div class="center"><button class="pp has big" data-k="photo" aria-label="Cambiar foto">${photo ? `<img src="${photo}" alt="">` : photo === '' ? '<span class="cam">📷</span>' : av(p, 'fill')}</button><div class="mute small">${u && !p.photo ? 'Usa la foto de su perfil en la app' : 'Toca para cambiar la foto'}</div></div>
    <label class="lbl">Nombre</label><input id="ep-n" maxlength="40" value="${esc(p.name)}">
    <div class="grid" style="margin-top:8px"><input id="ep-num" inputmode="numeric" maxlength="3" placeholder="Número" value="${esc(p.num || '')}"><select id="ep-pos">${POS.map(x => `<option${x === p.pos ? ' selected' : ''}>${x}</option>`).join('')}</select></div>
    <label class="lbl">Categoría</label><select id="ep-cat">${cats().map(c => `<option value="${c.id}"${c.id === p.cat ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
    <label class="lbl">WhatsApp del acudiente</label><input id="ep-tel" type="tel" inputmode="tel" placeholder="Para recordar pagos (opcional)" value="${esc(phoneShow(telOf(pid)))}">
    <div class="linkbox">${u ? `<div class="row">${uav(u)}<div class="grow"><div class="name">${esc(u.name)}</div><div class="mute">Vinculado a la app</div></div><button class="btn alt sm" data-k="unlink">Desvincular</button></div>` : `<div class="mute">No está vinculado a ninguna persona de la app.</div>${unlinkedUsers().length ? `<select id="ep-link"><option value="">Vincular con…</option>${unlinkedUsers().map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select>` : ''}`}</div>
    <button class="btn" data-k="save" style="margin-top:12px">Guardar</button>
    <button class="btn alt danger" data-k="del" style="margin-top:8px">Quitar del plantel</button>`;
  const s = sheet(html());
  hydrate(s.body);
  s.body.addEventListener('click', async e => {
    const b = e.target.closest('[data-k]'); if (!b) return;
    const k = b.dataset.k;
    if (k === 'photo') { const d = await choosePhoto(); if (d) { const keep = grab(s.body); photo = d; s.set(html()); put(s.body, keep); } }
    else if (k === 'unlink') { B.update('players/' + pid, { uid: B.DEL() }); log('Desvinculó a ' + p.name); s.close(); }
    else if (k === 'del') {
      ask('¿Quitar a ' + p.name + ' del plantel?', () => {
        const ops = [['del', 'players/' + pid], ['del', 'pay/' + pid]];
        cats().forEach(c => Object.keys(c.lineup || {}).forEach(i => { if (c.lineup[i] === pid) ops.push(['update', 'cats/' + c.id, { ['lineup.' + i]: B.DEL() }]); }));
        B.batch(ops); log('Jugador quitado: ' + p.name); s.close();
      }, { sub: 'También se borra su historial de pagos. Si tiene la app, seguirá registrado como persona.' });
    }
    else if (k === 'save') {
      const n = s.body.querySelector('#ep-n').value.trim(), prob = nameProblem(n);
      if (prob) { toast(prob); return; }
      const cat = s.body.querySelector('#ep-cat').value;
      const upd = { name: cleanName(n), num: s.body.querySelector('#ep-num').value.replace(/\D/g, '').slice(0, 3), pos: s.body.querySelector('#ep-pos').value, cat };
      if (photo) upd.photo = B.putImage(photo);
      const lk = s.body.querySelector('#ep-link');
      if (lk && lk.value) upd.uid = lk.value;
      const ops = [['update', 'players/' + pid, upd]];
      const tv = s.body.querySelector('#ep-tel').value.trim(), tn = phoneNorm(tv);
      if (tv && !tn) { toast('El WhatsApp no es válido: escribe 10 dígitos, por ejemplo 300 123 4567.'); return; }
      if (tn !== telOf(pid)) ops.push(['set', 'pay/' + pid, tn ? { tel: tn, telT: Date.now() } : { tel: B.DEL(), telT: Date.now() }]);
      if (cat !== p.cat) { const oc = C(p.cat); if (oc) Object.keys(oc.lineup || {}).forEach(i => { if (oc.lineup[i] === pid) ops.push(['update', 'cats/' + oc.id, { ['lineup.' + i]: B.DEL() }]); }); }
      B.batch(ops); log('Jugador editado: ' + upd.name); s.close(); toast('Cambios guardados.', { ok: true });
    }
  });
}
const grab = root => Array.from(root.querySelectorAll('input[id],select[id]')).map(e => [e.id, e.value]);
const put = (root, kv) => kv.forEach(([id, v]) => { const e = root.querySelector('#' + id); if (e) e.value = v; });
const unlinkedUsers = () => list(D.users, (a, b) => byName(a.name, b.name)).filter(u => !playerOfUser(u.id));

function approveSheet(uidv) {
  const u = D.users[uidv]; if (!u) return;
  if (!cats().length) { toast('Primero crea una categoría.'); return; }
  const s = sheet(`<div class="row">${uav(u, 'lg')}<div class="grow"><div class="name">${esc(u.name)}</div><div class="mute">Agregar al plantel</div></div></div>
    <label class="lbl">Categoría</label><select id="ap-cat">${cats().map(c => `<option value="${c.id}"${c.id === u.cat ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
    <div class="grid" style="margin-top:8px"><input id="ap-num" inputmode="numeric" maxlength="3" placeholder="Número (opcional)"><select id="ap-pos">${POS.map(x => `<option${x === 'Medio' ? ' selected' : ''}>${x}</option>`).join('')}</select></div>
    <input id="ap-tel" type="tel" inputmode="tel" placeholder="WhatsApp del acudiente (opcional)" value="${esc(phoneShow((D.tels[uidv] || {}).tel || ''))}">
    <button class="btn" data-k="ok" style="margin-top:12px">✓ Agregar al plantel</button>`);
  hydrate(s.body);
  s.body.querySelector('[data-k]').onclick = () => {
    const cat = s.body.querySelector('#ap-cat').value;
    const tv = s.body.querySelector('#ap-tel').value.trim(), tn = phoneNorm(tv);
    if (tv && !tn) { toast('El WhatsApp no es válido: escribe 10 dígitos, por ejemplo 300 123 4567.'); return; }
    const pid = rid();
    B.set('players/' + pid, { name: u.name, num: s.body.querySelector('#ap-num').value.replace(/\D/g, '').slice(0, 3), pos: s.body.querySelector('#ap-pos').value, cat, uid: uidv, t: Date.now() }, false);
    if (tn && tn !== (D.tels[uidv] || {}).tel) B.set('pay/' + pid, { tel: tn, telT: Date.now() });
    log('Agregó al plantel: ' + u.name + ' (' + cname(cat) + ')'); s.close();
    toast(u.name + ' ya está en ' + cname(cat) + '.', { ok: true });
  };
}
function link(uidv, pid) {
  const p = P(pid), u = D.users[uidv]; if (!p || !u) return;
  const doIt = () => { B.update('players/' + pid, { uid: uidv }); log('Vinculó ' + u.name + ' con ' + p.name); toast('Vinculado: ' + p.name + ' ahora tiene la app.', { ok: true }); };
  if (p.uid && p.uid !== uidv) ask(p.name + ' ya está vinculado con otra persona. ¿Cambiarlo?', doIt, { yes: 'Sí, cambiar', safe: true });
  else doIt();
}
function linkSheet(uidv) {
  const u = D.users[uidv]; if (!u) return;
  const ps = playersByName();
  const s = sheet(`<div class="name">Vincular a ${esc(u.name)} con un jugador del plantel</div><input id="lk-q" placeholder="Buscar jugador" style="margin:10px 0"><div class="lklist"></div>`);
  const paint = () => {
    const q = norm(s.body.querySelector('#lk-q').value);
    s.body.querySelector('.lklist').innerHTML = ps.filter(p => !q || norm(p.name).includes(q)).map(p => `<button class="card row prow2" data-p="${p.id}">${av(p)}<div class="grow"><div class="name">${esc(p.name)}</div><div class="mute">${esc(cname(p.cat))}${p.uid ? ' · ya tiene la app' : ''}</div></div></button>`).join('') || '<div class="empty">No hay jugadores.</div>';
    hydrate(s.body);
  };
  paint();
  s.body.querySelector('#lk-q').addEventListener('input', paint);
  s.body.addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (!b) return; s.close(); link(uidv, b.dataset.p); });
}
function personSheet(uidv) {
  const u = D.users[uidv]; if (!u) return;
  const p = playerOfUser(uidv), host = !!D.hosts[uidv];
  const s = sheet(`<div class="center">${uav(u, 'xl')}</div>
    <label class="lbl">Nombre</label><input id="ps-n" maxlength="40" value="${esc(u.name)}"><div class="err" id="ps-err"></div>
    <div class="mute" style="margin:8px 0">${host ? '<b class="gold">Anfitrión</b> · ' : ''}${p ? 'En el plantel: <b>' + esc(p.name) + '</b> · ' + esc(cname(p.cat)) : u.np ? 'Marcado como «no es jugador»' : 'Sin plantel'} · visto ${esc(new Date(u.last || u.t).toLocaleDateString('es'))}</div>
    <button class="btn" data-k="save">Guardar nombre</button>
    ${p ? '' : '<button class="btn alt" data-k="add" style="margin-top:8px">Agregar al plantel</button><button class="btn alt" data-k="link" style="margin-top:8px">Vincular con jugador existente</button>'}
    ${u.np ? '<button class="btn alt" data-k="isplayer" style="margin-top:8px">Sí es jugador</button>' : ''}
    ${uidv === B.uid ? '<div class="mute small center" style="margin-top:12px">Para borrarte a ti: toca tu foto (arriba) → «Borrar mi cuenta del club».</div>' : p
      ? '<button class="btn alt danger" data-k="del" style="margin-top:14px">Borrar por completo (perfil, ficha y pagos)</button><button class="btn alt" data-k="delkeep" style="margin-top:8px">Borrar solo su perfil (conservar la ficha)</button>'
      : '<button class="btn alt danger" data-k="del" style="margin-top:14px">Borrar persona por completo</button>'}`);
  hydrate(s.body);
  s.body.addEventListener('click', e => {
    const b = e.target.closest('[data-k]'); if (!b) return;
    const k = b.dataset.k;
    if (k === 'save') { const n = s.body.querySelector('#ps-n').value, prob = nameProblem(n); if (prob) { s.body.querySelector('#ps-err').textContent = prob; return; } B.update('users/' + uidv, { name: cleanName(n) }); log('Cambió el nombre de ' + u.name + ' → ' + cleanName(n)); s.close(); }
    else if (k === 'add') { s.close(); approveSheet(uidv); }
    else if (k === 'link') { s.close(); linkSheet(uidv); }
    else if (k === 'isplayer') { B.update('users/' + uidv, { np: B.DEL() }); s.close(); }
    else if (k === 'del') ask('¿Borrar a ' + u.name + ' por completo?', async () => {
      s.close();
      const ops = await eraseOps(uidv, { ficha: true });
      B.batch(ops); toast(u.name + ' ya no aparece en ninguna parte.', { ok: true });
    }, { sub: 'Se borra su perfil, su ficha del plantel, sus pagos, su acceso de anfitrión y lo que lo nombra en el registro. Si vuelve a abrir la app, tendrá que registrarse otra vez.' });
    else if (k === 'delkeep') ask('¿Borrar el perfil de ' + u.name + '?', async () => {
      s.close();
      B.batch(await eraseOps(uidv, { ficha: false })); toast('Perfil borrado. Su ficha del plantel se conserva.', { ok: true });
    }, { sub: 'Su ficha del plantel y sus pagos se conservan, sin vínculo con la app.' });
  });
}

// Tarjetas que funcionan como botón (uniformes): también con teclado.
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[role=button][data-act]')) { e.preventDefault(); e.target.click(); }
});

// ── Cambios en campos ───────────────────────────────────────────────────────
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'ob-name') obInput();
  else if (t.id === 'pq') { U.pq = t.value; clearTimeout(t._d); t._d = setTimeout(render, 120); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.closest('.sheet') || t.closest('.dlg')) return;
  const c = U.cat ? C(U.cat) : null;
  if (t.dataset.res !== undefined && t.dataset.res) {
    const m = D.matches[t.dataset.res]; if (!m || !R.host) return;
    B.update('matches/' + t.dataset.res, { res: t.value.trim().replace(/\s*[-–:x]\s*/i, '-') });
    log('Resultado vs ' + m.rival + ': ' + t.value.trim()); toast('Marcador guardado.', { ok: true });
  }
  else if (t.id === 'fee' && c) {
    const n = +String(t.value).replace(/\D/g, '') || 0;
    B.update('cats/' + c.id, { fee: n }); t.value = n ? '$' + n.toLocaleString('es-CO') : '';
    log('Cuota de ' + c.name + ': $' + n.toLocaleString('es-CO'));
  }
  else if (t.id === 'ft' && c) {
    const nf = FT[t.value][0], n = slots(nf).length, lu = {};
    Object.keys(c.lineup || {}).forEach(k => { if (+k < n) lu[k] = c.lineup[k]; });
    B.update('cats/' + c.id, { fmt: t.value, form: nf, lineup: lu }); U.slot = null;
  }
  else if (t.id === 'fm' && c) { B.update('cats/' + c.id, { form: t.value }); U.slot = null; }
  else if (t.id === 'lc') { U.lcat = t.value; syncSubs(); render(); }
  else if (t.id === 'd') { U.date = t.value || today(); syncSubs(); render(); }
  else if (t.id === 'k') { U.kind = t.value; syncSubs(); render(); }
  else if (t.id === 'pfil') { U.pfil = t.value; render(); }
});
