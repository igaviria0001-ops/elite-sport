// Pantallas de Elite Sport (HTML). Solo dibujan; las acciones están en actions.js.
import * as B from './backend.js';
import { D, U, R, cats, C, P, cname, players, myPlayer, userOf, photoOf, users, pendingUsers, feeOf, paidOf, nameMatch, isHostUser, playerOfUser, list } from './state.js';
import { esc, ymd, today, fmtDay, fmtShort, fmtTime, monthName, monthShort, addMonth, ago, stamp, money, slug, initials, firstName, byName, cap, thisMonth } from './util.js';
import { OB } from './onboard.js';

export const FT = { 'Fútbol 5': ['1-2-1', '2-2', '1-1-2'], 'Fútbol 6': ['2-2-1', '2-1-2', '1-3-1'], 'Fútbol 7': ['2-3-1', '3-2-1', '2-2-2', '3-1-2'], 'Fútbol 8': ['3-3-1', '3-2-2', '2-3-2'], 'Fútbol 9': ['3-3-2', '3-4-1', '4-3-1'], 'Fútbol 11': ['4-4-2', '4-3-3', '3-5-2', '4-2-3-1', '4-5-1', '3-4-3'] };
export const POS = ['Portero', 'Defensa', 'Medio', 'Delantero'];
export const TYPES = [['Técnico', '⚽'], ['Táctico', '🧠'], ['Físico', '💪'], ['Porteros', '🧤'], ['Definición', '🥅'], ['Partido de práctica', '🏟️'], ['Recuperación', '🧘'], ['Otro', '📝']];
const typeIcon = t => (TYPES.find(x => x[0] === t) || ['', '📝'])[1];
export function fmtOf(c) { if (c.fmt && FT[c.fmt]) return c.fmt; for (const k in FT) if (FT[k].includes(c.form)) return k; return 'Fútbol 11'; }
export function slots(f) {
  const L = String(f || '4-4-2').split('-').map(Number), r = L.length, s = [{ x: 50, y: 90 }];
  L.forEach((n, i) => { const y = r > 1 ? 72 - i * (56 / (r - 1)) : 45; for (let j = 0; j < n; j++) s.push({ x: (j + 1) * 100 / (n + 1), y }); });
  return s;
}

// ── Piezas pequeñas ─────────────────────────────────────────────────────────
export function img(id, cls = '', alt = '') {
  if (!id) return '';
  const u = B.imgCached(id);
  return `<img class="${cls}" data-img="${esc(id)}"${u ? ` src="${u}"` : ''} alt="${esc(alt)}">`;
}
export function av(p, cls = '') {
  const ph = photoOf(p);
  if (ph) return `<div class="num ${cls}">${img(ph)}</div>`;
  return `<div class="num ${cls}">${esc((p && p.num) || initials(p && p.name) || '–')}</div>`;
}
export function uav(u, cls = '') {
  if (u && u.photo) return `<div class="num ${cls}">${img(u.photo)}</div>`;
  return `<div class="num ${cls}">${esc(initials(u && u.name))}</div>`;
}
const HUES = ['#1F5FBF', '#2E7D4F', '#C98A00', '#6B3FA0', '#0F7C86', '#B5462B', '#3E4A59'];
function crestFor(name) {
  const r = D.rivals[slug(name)];
  if (r && r.img) return img(r.img, '', 'Escudo de ' + name);
  let h = 0; for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const t = String(name).split(/\s+/).map(w => w.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9]/g, '').charAt(0)).join('').slice(0, 2).toUpperCase() || '?';
  return `<span class="gen" style="background:${HUES[h % HUES.length]}">${esc(t)}</span>`;
}
function rv(name, act) {
  const inner = crestFor(name);
  return act ? `<button class="num rv" data-act="crest" data-name="${esc(name)}" aria-label="Poner o cambiar escudo">${inner}</button>` : `<div class="num rv">${inner}</div>`;
}
const catOpts = (sel, blank) => (blank ? `<option value="">${blank}</option>` : '') + cats().map(c => `<option value="${c.id}"${c.id === sel ? ' selected' : ''}>${esc(c.name)}</option>`).join('');
const empty = (t, btn) => `<div class="empty">${t}</div>${btn || ''}`;
const ctag = id => (id && cname(id) ? ` <span class="tag">${esc(cname(id))}</span>` : '');
function catChips(cur, act) {
  const cs = cats();
  if (cs.length < 2) return '';
  return `<div class="seg scroll">${[['', 'Todas']].concat(cs.map(c => [c.id, c.name])).map(([id, n]) => `<button class="${cur === id ? 'on' : ''}" data-act="${act}" data-id="${id}">${esc(n)}</button>`).join('')}</div>`;
}
function resTag(res) {
  const m = String(res || '').match(/^\s*(\d+)\s*[-–:x]\s*(\d+)\s*$/i);
  if (!m) return '';
  const a = +m[1], b = +m[2];
  return a > b ? '<span class="tag" style="background:var(--ok)">Ganado</span>' : a < b ? '<span class="tag" style="background:var(--no)">Perdido</span>' : '<span class="tag" style="background:var(--late)">Empate</span>';
}
const kitTag = k => (k ? ` <span class="tag" style="background:${k === 'Negro' ? '#111;border:1px solid #444' : 'var(--deep)'}">${esc(k)}</span>` : '');
function untilTxt(d) {
  const n = Math.round((new Date(d + 'T00:00') - new Date(today() + 'T00:00')) / 86400000);
  return n <= 0 ? '¡Es hoy!' : n === 1 ? 'Es mañana' : 'Faltan ' + n + ' días';
}
const upMatches = cat => list(D.matches).filter(m => m.date >= today() && (!cat || m.cat === cat || !m.cat)).sort((a, b) => ((a.date + (a.time || '')) < (b.date + (b.time || '')) ? -1 : 1));
const upTrain = cat => list(D.train).filter(x => x.date >= today() && (!cat || x.cat === cat || !x.cat)).sort((a, b) => ((a.date + (a.time || '')) < (b.date + (b.time || '')) ? -1 : 1));

// ── Encabezado ──────────────────────────────────────────────────────────────
export function headerRole(st) {
  if (!R.profile) return '';
  const dot = !st.online ? '<span class="sync off">● Sin conexión</span>' : st.pending ? '<span class="sync busy">↻ Guardando…</span>' : '<span class="sync on" title="En línea y al día">●</span>';
  const mp = myPlayer();
  const who = R.host ? `<b class="gold">ANFITRIÓN</b> · ${esc(firstName(R.profile.name))}` : `Hola, ${esc(firstName(R.profile.name))}${mp && mp.cat ? ' · ' + esc(cname(mp.cat)) : ''}`;
  return `${who} ${dot}`;
}
export function headerMe() {
  if (!R.profile) return '';
  return `<button class="me" data-act="profile" aria-label="Mi perfil">${uav(R.profile)}</button>`;
}
export function navHtml() {
  const tabs = [['inicio', 'Inicio'], ['cats', 'Categorías'], ['partidos', 'Partidos'], ['entreno', 'Entreno'], ['lista', R.host ? 'Lista' : 'Asistencia'], ['pagos', 'Pagos']];
  if (R.host) tabs.push(['personas', 'Personas']);
  const n = R.host ? pendingUsers().length : 0;
  return tabs.map(([t, l]) => `<button data-tab="${t}" class="${U.tab === t ? 'on' : ''}">${l}${t === 'personas' && n ? ` <span class="badge">${n}</span>` : ''}</button>`).join('');
}

// ── Bienvenida / registro ───────────────────────────────────────────────────
export function gateHead(sub) {
  return `<div class="gate"><button class="hostkey" data-act="hostkey" aria-label="Acceso de anfitrión">🔑</button><img src="assets/escudo.jpg" alt="Escudo Elite Sport"><div class="gt">ELITE SPORT</div><div class="gs">${sub}</div></div>`;
}
function installCard() {
  if (isApp()) return '';
  const ua = navigator.userAgent, ios = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return `<button class="card instc" data-act="install"><span class="ico">📲</span><span class="grow"><b>Instala la app en tu celular</b><small>${ios ? 'Instálala antes de registrarte: en iPhone la app instalada guarda su propia sesión.' : 'Queda con el escudo del club, como una app más. Puedes instalarla ahora o después.'}</small></span><span class="chev">›</span></button>`;
}
export function vOnboard() {
  const cs = cats();
  const ph = OB.photo ? `<img src="${OB.photo}" alt="Tu foto">` : '<span class="cam">📷</span><span>Agregar foto</span>';
  return gateHead(R.host ? 'Acceso de anfitrión activo' : 'Bienvenidos al club') + installCard() + `
  <div class="card onb">
    <div class="step">Crea tu perfil${R.host ? '' : ' de jugador'}</div>
    <button class="pp${OB.photo ? ' has' : ''}" data-act="ob-photo" aria-label="Foto de perfil">${ph}</button>
    <div class="mute center">${OB.photo ? 'Toca la foto para cambiarla' : 'Una foto donde se vea bien la cara' + (R.host ? ' (opcional para anfitriones)' : '')}</div>
    <label class="lbl" for="ob-name">${R.host ? 'Tu nombre y apellido' : 'Nombre y apellido del jugador'}</label>
    <input id="ob-name" data-keep autocomplete="name" autocapitalize="words" maxlength="40" placeholder="Ej. Santiago Gómez" value="${esc(OB.name || '')}">
    <div class="err" id="ob-err" aria-live="polite"></div>
    ${cs.length && !R.host ? `<label class="lbl" for="ob-cat">Categoría</label><select id="ob-cat" data-keep>${catOpts(OB.cat || '', '¿En qué categoría juega?')}</select>` : ''}
    <button class="btn" data-act="ob-save" style="margin-top:14px">Entrar</button>
    <div class="mute small center" style="margin-top:10px">Los anfitriones del club verán tu nombre y tu foto para identificarte. Se guarda en este celular: no tendrás que volver a registrarte.</div>
  </div>`;
}
export function vBoot() {
  if (R.boot === 'error') return gateHead('Sin conexión') + `<div class="card center"><div class="name">No se pudo conectar</div><div class="mute" style="margin:6px 0 12px">${esc(R.bootErr || 'La primera vez se necesita internet (wifi o datos) para entrar.')}</div><button class="btn" data-act="retry">Reintentar</button></div>`;
  return `<div class="splash"><img src="assets/escudo.jpg" alt=""><div>Cargando…</div></div>`;
}

// ── Inicio ──────────────────────────────────────────────────────────────────
function localBanner() {
  if (B.MODE !== 'local') return '';
  return `<div class="card note"><b>Modo local (sin servidor).</b> Los datos solo quedan en este aparato. Para que funcione en línea, conecta Firebase (ver la guía).${R.host ? '' : ' Código de prueba para anfitrión: <b>DEMO</b>.'}</div>`;
}
function ficha(mp) {
  const ym = thisMonth(), pd = paidOf(mp.id, ym);
  return `<div class="card ficha"><div class="row">${av(mp, 'xl')}<div class="grow"><small>Tu ficha</small><div class="big2">${esc(mp.name)}</div><div class="mute">${esc(cname(mp.cat) || 'Sin categoría')}${mp.num ? ' · #' + esc(mp.num) : ''}${mp.pos ? ' · ' + esc(mp.pos) : ''}</div></div></div>
  <div class="frow"><span>Pago de ${esc(monthName(ym).split(' ')[0].toLowerCase())}</span><span class="tag" style="background:${pd ? 'var(--ok)' : 'var(--no)'}">${pd ? 'Al día ✓' : 'Pendiente'}</span></div></div>`;
}
function heroMatch(m) {
  return `<div class="card hero"><small>Próximo partido${m.cat ? ' · ' + esc(cname(m.cat)) : ''} · ${untilTxt(m.date)}</small><div class="big">${rv(m.rival)}<span>vs ${esc(m.rival)}</span></div><div>${esc(fmtDay(m.date))}${m.time ? ' · ' + esc(fmtTime(m.time)) : ''}</div>${m.place || m.kit ? `<small>${esc(m.place || '')}${m.place && m.kit ? ' · ' : ''}${m.kit ? 'Uniforme ' + esc(m.kit.toLowerCase()) : ''}</small>` : ''}</div>`;
}
function trainMini(x) {
  return `<button class="card tmini" data-tab="entreno"><div class="ti">${typeIcon(x.type)}</div><div class="grow"><small>Próximo entrenamiento${x.cat ? ' · ' + esc(cname(x.cat)) : ''}</small><div class="name">${esc(fmtDay(x.date))}${x.time ? ' · ' + esc(fmtTime(x.time)) : ''}</div><div class="mute">${esc([x.type, x.place].filter(Boolean).join(' · '))}</div></div><span class="chev">›</span></button>`;
}
function catGrid() {
  return '<div class="cats">' + cats().map(c => {
    const n = players(c.id).length, pend = R.host ? pendingUsers().filter(u => u.cat === c.id).length : 0;
    return `<button class="cat" data-act="opencat" data-id="${c.id}"><b>${esc(c.name)}</b>${n} jugador${n === 1 ? '' : 'es'}${pend ? `<span class="badge">${pend} nuevo${pend === 1 ? '' : 's'}</span>` : ''}</button>`;
  }).join('') + '</div>';
}
export function vInicio() {
  let h = localBanner();
  const mp = myPlayer(), fc = R.host ? '' : mp ? mp.cat : (R.profile.cat && D.cats[R.profile.cat] ? R.profile.cat : '');
  if (!R.host) {
    if (mp) h += ficha(mp);
    else h += `<div class="card hero"><div class="big">¡Hola, ${esc(firstName(R.profile.name))}!</div><small>Tu perfil quedó registrado. El anfitrión te agregará al plantel de tu categoría.</small></div>`;
  } else {
    const n = pendingUsers().length;
    if (n) h += `<button class="card alertc" data-tab="personas"><span class="badge big">${n}</span><span class="grow">${n === 1 ? 'Una persona nueva se registró' : n + ' personas nuevas se registraron'}. Agrégalas al plantel.</span><span class="chev">›</span></button>`;
  }
  const up = upMatches(fc)[0];
  if (up) h += heroMatch(up);
  else if (R.host) h += `<div class="card hero"><div class="big">Bienvenido, Elite Sport</div><small>${cats().length ? 'No hay partidos programados.' : 'Crea tus categorías y agrega a tus jugadores.'}</small></div>`;
  const nt = upTrain(fc)[0];
  if (nt) h += trainMini(nt);
  h += '<h2>Categorías</h2>';
  if (!cats().length) h += R.host ? empty('Aún no hay categorías.', '<button class="btn" data-go="cats">Crear categoría</button>') : empty('Aún no hay categorías.');
  else h += catGrid();
  const showCats = R.host ? cats() : cats().filter(c => mp && c.id === mp.cat);
  showCats.forEach(c => {
    const ps = players(c.id);
    if (!ps.length) return;
    h += `<h2>${R.host ? esc(c.name) : 'Tu equipo · ' + esc(c.name)}</h2><div class="card">` + ps.map(p => `<div class="row prow">${av(p)}<div class="grow name">${esc(p.name)}${p.id === (mp && mp.id) ? ' <span class="mute">(tú)</span>' : ''}</div><span class="mute">${esc(p.pos || '')}</span></div>`).join('') + '</div>';
  });
  h += vKits();
  if (R.host) h += vLog();
  h += vInstall();
  if (!R.host) h += '<div class="foot"><button class="lnk" data-act="hostkey">Acceso de anfitrión</button></div>';
  return h;
}
function vKits() {
  const k = (id, nm) => {
    const im = D.kits[id] && D.kits[id].img;
    const pic = im ? img(im, 'kit', 'Uniforme ' + nm) : `<img class="kit" src="assets/uniforme-${id === 'red' ? 'rojo' : 'negro'}.jpg" alt="Uniforme ${nm}">`;
    return `<div class="card kitc"><div class="name">Uniforme ${nm}</div><button class="kitb" data-act="viewkit" data-id="${id}" aria-label="Ver uniforme ${nm}">${pic}</button>${R.host ? `<button class="mini" data-act="kitphoto" data-id="${id}">📷 Cambiar foto</button>` : ''}</div>`;
  };
  return `<h2>Uniformes</h2><div class="kits">${k('red', 'rojo')}${k('black', 'negro')}</div>`;
}
function vLog() {
  const L = list(D.log, (a, b) => b.t - a.t);
  if (!L.length) return '';
  return '<h2>Registro</h2><div class="card">' + L.slice(0, 15).map(e => `<div class="logr"><div>${esc(e.x)}</div><div class="mute">${esc(e.w || '')} · ${esc(stamp(e.t))}</div></div>`).join('') + '</div>';
}
export function getDefer() { const d = window.__bip; window.__bip = null; return d; }
export function isApp() { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } }
function vInstall() {
  if (isApp()) return '';
  return '<button class="btn alt inst" data-act="install">📲 Instalar la app en el celular</button>';
}

// ── Categorías ──────────────────────────────────────────────────────────────
export function vCats() {
  let h = R.host ? '<div class="card"><div class="row"><input id="cn" data-keep maxlength="30" placeholder="Nueva categoría (ej. Sub-15)"><button class="btn" style="width:auto" data-act="addcat">Crear</button></div></div>' : '';
  if (!cats().length) return h + empty(R.host ? 'Crea tu primera categoría para armar plantel y alineaciones.' : 'Aún no hay categorías.');
  return h + catGrid();
}
export function vCat(c) {
  const ps = players(c.id), sl = slots(c.form), used = {}, lu = c.lineup || {};
  sl.forEach((_, i) => { if (lu[i] && P(lu[i]) && P(lu[i]).cat === c.id) used[lu[i]] = 1; });
  let h = `<div class="row ctop"><button class="btn alt back" data-act="back">‹ Categorías</button><h2 class="grow">${esc(c.name)}</h2>${R.host ? `<button class="x" aria-label="Cambiar nombre" data-act="rencat" data-id="${c.id}">✎</button><button class="x" aria-label="Borrar categoría" data-act="delcat" data-id="${c.id}">×</button>` : ''}</div>`;
  if (R.host) h += `<div class="card"><div class="row"><div class="grow"><div class="name">Cuota mensual</div><div class="mute">Valor que paga cada jugador de ${esc(c.name)} al mes</div></div><input id="fee" data-keep class="fee" inputmode="numeric" placeholder="$ 0" value="${c.fee ? esc(money(c.fee)) : ''}" data-id="${c.id}"></div></div>`;
  const ft = fmtOf(c);
  h += `<h2>Alineación</h2><div class="mute">${esc(ft)} · ${esc(c.form || '')}</div>`;
  if (R.host) h += `<div class="grid"><select id="ft" aria-label="Formato">${Object.keys(FT).map(o => `<option${o === ft ? ' selected' : ''}>${o}</option>`).join('')}</select><select id="fm" aria-label="Formación">${FT[ft].map(f => `<option${f === c.form ? ' selected' : ''}>${f}</option>`).join('')}</select></div>`;
  h += '<div class="pitch"><svg viewBox="0 0 100 125" preserveAspectRatio="none"><rect x="3" y="3" width="94" height="119"/><line x1="3" y1="62.5" x2="97" y2="62.5"/><circle cx="50" cy="62.5" r="10"/><rect x="26" y="3" width="48" height="18"/><rect x="26" y="104" width="48" height="18"/></svg>';
  sl.forEach((s, i) => {
    const p = used[lu[i]] ? P(lu[i]) : null;
    const inner = `<i>${p ? (photoOf(p) ? img(photoOf(p)) : esc(p.num || '•')) : (R.host ? '+' : '')}</i>${p ? esc(firstName(p.name)) : ''}`;
    h += R.host
      ? `<button class="slot${p ? '' : ' empty-s'}${U.slot === i ? ' sel' : ''}" data-act="slot" data-i="${i}" style="left:${s.x}%;top:${s.y}%" aria-label="Posición ${i + 1}">${inner}</button>`
      : `<div class="slot${p ? '' : ' empty-s'}" style="left:${s.x}%;top:${s.y}%">${inner}</div>`;
  });
  h += '</div>';
  if (R.host && U.slot !== null) {
    const cur = lu[U.slot] && used[lu[U.slot]], avl = ps.filter(p => !used[p.id]);
    h += `<div class="card"><b>Elegir jugador para esta posición</b><div class="pick">${avl.length ? avl.map(p => `<button data-act="put" data-id="${p.id}">${esc(p.num ? p.num + ' · ' : '')}${esc(p.name)}</button>`).join('') : '<span class="mute">No quedan jugadores disponibles.</span>'}</div><div class="chips">${cur ? '<button data-act="clearslot">Quitar de la posición</button>' : ''}<button data-act="closeslot">Cerrar</button></div></div>`;
  }
  const bench = ps.filter(p => !used[p.id]);
  if (ps.length) h += `<div class="card"><b>Suplentes (${bench.length})</b><div class="mute">${bench.map(p => esc(p.name)).join(', ') || 'Todos están en la alineación'}</div></div>`;
  if (R.host) {
    const pend = pendingUsers().filter(u => u.cat === c.id);
    if (pend.length) h += `<h2>Se registraron en ${esc(c.name)}</h2>` + pend.map(u => `<div class="card"><div class="row">${uav(u)}<div class="grow"><div class="name">${esc(u.name)}</div><div class="mute">Se registró ${esc(ago(u.t))}</div></div><button class="btn sm" data-act="approve" data-id="${u.id}">✓ Agregar</button></div></div>`).join('');
  }
  h += `<h2>Jugadores (${ps.length})</h2>`;
  if (R.host) h += `<div class="card"><div class="grid"><input id="pn" data-keep maxlength="40" autocapitalize="words" placeholder="Nombre y apellido"><input id="pm" data-keep inputmode="numeric" maxlength="3" placeholder="Número"></div><div class="grid"><select id="pp" data-keep>${POS.map(p => `<option>${p}</option>`).join('')}</select><button class="btn" data-act="addplayer">Agregar</button></div></div>`;
  if (!ps.length) h += empty('Esta categoría no tiene jugadores todavía.');
  ps.forEach(p => {
    const u = userOf(p);
    const inner = `${av(p)}<div class="grow"><div class="name">${esc(p.name)}</div>${R.host ? `<div class="mute">${u ? '✓ Tiene la app' : 'Sin vincular a la app'}</div>` : ''}</div>${p.num ? `<span class="mute">#${esc(p.num)}</span>` : ''}<span class="tag">${esc(p.pos || '—')}</span>`;
    h += R.host ? `<button class="card row prow2" data-act="editplayer" data-id="${p.id}">${inner}<span class="chev">›</span></button>` : `<div class="card row prow2">${inner}</div>`;
  });
  return h;
}

// ── Partidos ────────────────────────────────────────────────────────────────
function defCat() { if (U.fcat === null) { const mp = myPlayer(); U.fcat = !R.host && mp && D.cats[mp.cat] ? mp.cat : ''; } if (U.fcat && !D.cats[U.fcat]) U.fcat = ''; }
export function vPartidos() {
  defCat();
  const t = today(), em = U.editMatch ? D.matches[U.editMatch] : null;
  let h = '';
  if (R.host) {
    const m = em || {};
    h += `<div class="card form"><div class="ftitle">${em ? 'Editar partido' : 'Nuevo partido'}</div>
    <div class="grid"><input id="mr" data-keep maxlength="40" placeholder="Rival" value="${esc(m.rival || '')}"><input id="mp" data-keep maxlength="60" placeholder="Cancha o lugar" value="${esc(m.place || '')}"></div>
    <div class="grid"><input type="date" id="md" data-keep value="${esc(m.date || t)}" aria-label="Fecha"><input type="time" id="mt" data-keep value="${esc(m.time || '')}" aria-label="Hora"></div>
    <button class="btn alt pickc" data-act="mcrest">${OBM.crest ? `<img src="${OBM.crest}" alt="">Escudo listo ✓` : '📷 Escudo del rival (opcional)'}</button>
    ${cats().length ? `<select id="mc" data-keep aria-label="Categoría">${catOpts(m.cat || U.fcat || '', 'Todas las categorías')}</select>` : ''}
    <select id="mk" data-keep aria-label="Uniforme"><option value="">Uniforme: por definir</option><option${m.kit === 'Rojo' ? ' selected' : ''}>Rojo</option><option${m.kit === 'Negro' ? ' selected' : ''}>Negro</option></select>
    <button class="btn" data-act="savematch">${em ? 'Guardar cambios' : 'Guardar partido'}</button>${em ? '<button class="btn alt" data-act="canceledit" style="margin-top:8px">Cancelar</button>' : ''}</div>`;
  }
  h += catChips(U.fcat, 'fcat');
  const ms = list(D.matches).filter(m => !U.fcat || m.cat === U.fcat || !m.cat);
  const up = ms.filter(m => m.date >= t).sort((a, b) => ((a.date + (a.time || '')) < (b.date + (b.time || '')) ? -1 : 1));
  const past = ms.filter(m => m.date < t).sort((a, b) => (a.date < b.date ? 1 : -1));
  h += '<h2>Próximos</h2>';
  h += up.length ? up.map(m => mCard(m, false)).join('') : empty('No hay partidos programados.');
  if (past.length) h += '<h2>Jugados</h2>' + past.map(m => mCard(m, true)).join('');
  return h;
}
export const OBM = { crest: '' };
function mCard(m, past) {
  const canRes = R.host && m.date <= today();
  return `<div class="card mcard"><div class="row">${rv(m.rival, R.host)}<div class="grow"><div class="name">vs ${esc(m.rival)}${ctag(m.cat)}${kitTag(m.kit)}</div><div class="mute">${esc(fmtDay(m.date))}${m.time ? ' · ' + esc(fmtTime(m.time)) : ''}${m.place ? ' · ' + esc(m.place) : ''}</div></div>
  ${canRes ? `<input class="res" id="res-${m.id}" data-keep inputmode="text" maxlength="9" placeholder="Marcador" value="${esc(m.res || '')}" data-res="${m.id}" aria-label="Marcador (Elite - rival)">` : m.res ? `<div class="score">${esc(m.res)}</div>` : ''}
  ${R.host ? `<button class="x" aria-label="Editar partido" data-act="editmatch" data-id="${m.id}">✎</button><button class="x" aria-label="Borrar partido" data-act="delmatch" data-id="${m.id}">×</button>` : ''}</div>${past && m.res ? `<div class="rrow">${resTag(m.res)}</div>` : ''}</div>`;
}

// ── Entrenamientos ──────────────────────────────────────────────────────────
export function vEntreno() {
  defCat();
  const t = today(), ex = U.editTrain ? D.train[U.editTrain] : null;
  let h = '';
  if (R.host) {
    const x = ex || {};
    h += `<div class="card form"><div class="ftitle">${ex ? 'Editar entrenamiento' : 'Nuevo entrenamiento'}</div>
    <div class="grid"><input type="date" id="td" data-keep value="${esc(x.date || t)}" aria-label="Fecha"><input type="time" id="tt" data-keep value="${esc(x.time || '')}" aria-label="Hora"></div>
    <div class="grid"><input id="tp" data-keep maxlength="60" placeholder="Lugar" value="${esc(x.place || '')}"><select id="tc" data-keep aria-label="Categoría">${cats().length ? catOpts(x.cat || U.fcat || '', 'Todas las categorías') : '<option value="">Sin categoría</option>'}</select></div>
    <select id="ty" data-keep aria-label="Tipo de entrenamiento">${TYPES.map(([n, i]) => `<option value="${n}"${(x.type || 'Técnico') === n ? ' selected' : ''}>${i} ${n}</option>`).join('')}</select>
    <textarea id="tn" data-keep rows="2" maxlength="400" placeholder="Qué se va a trabajar (ej. pases cortos, definición)">${esc(x.note || '')}</textarea>
    ${ex ? '' : '<select id="tr" data-keep aria-label="Repetir"><option value="1">Solo este día</option><option value="4">Repetir cada semana · 4 semanas</option><option value="8">Repetir cada semana · 8 semanas</option><option value="12">Repetir cada semana · 12 semanas</option></select>'}
    <button class="btn" data-act="savetrain">${ex ? 'Guardar cambios' : 'Guardar entrenamiento'}</button>${ex ? '<button class="btn alt" data-act="canceledit" style="margin-top:8px">Cancelar</button>' : ''}</div>`;
  }
  h += catChips(U.fcat, 'fcat');
  const all = list(D.train).filter(x => !U.fcat || x.cat === U.fcat || !x.cat);
  const up = all.filter(x => x.date >= t).sort((a, b) => ((a.date + (a.time || '')) < (b.date + (b.time || '')) ? -1 : 1));
  const past = all.filter(x => x.date < t).sort((a, b) => (a.date < b.date ? 1 : -1));
  h += '<h2>Próximos entrenamientos</h2>' + (up.length ? up.map(tCard).join('') : empty('No hay entrenamientos programados.'));
  if (past.length) {
    h += '<h2>Anteriores</h2>' + past.slice(0, U.pastN).map(tCard).join('');
    if (past.length > U.pastN) h += `<button class="btn alt" data-act="morepast">Ver más (${past.length - U.pastN})</button>`;
  }
  return h;
}
function tCard(x) {
  const ph = (x.photos || []).map((p, i) => `<button class="tph" data-act="viewphoto" data-id="${x.id}" data-i="${i}" aria-label="Ver foto">${img(p.th, '', 'Foto del entrenamiento')}</button>`).join('');
  return `<div class="card tcard"><div class="row"><div class="ti">${typeIcon(x.type)}</div><div class="grow"><div class="name">${esc(fmtDay(x.date))}${x.time ? ' · ' + esc(fmtTime(x.time)) : ''}</div><div class="mute">${esc([x.type, x.place].filter(Boolean).join(' · '))}${ctag(x.cat)}</div></div>${R.host ? `<button class="x" aria-label="Editar entrenamiento" data-act="edittrain" data-id="${x.id}">✎</button><button class="x" aria-label="Borrar entrenamiento" data-act="deltrain" data-id="${x.id}">×</button>` : ''}</div>
  ${x.note ? `<div class="tnote">${esc(x.note)}</div>` : ''}${ph ? `<div class="tphs">${ph}</div>` : ''}${R.host ? `<button class="btn alt sm2" data-act="trainphotos" data-id="${x.id}">📷 Agregar fotos</button>` : ''}</div>`;
}

// ── Asistencia ──────────────────────────────────────────────────────────────
const MK = { P: ['Presente', 'var(--ok)'], T: ['Tarde', 'var(--late)'], A: ['Ausente', 'var(--no)'] };
export function vLista() {
  if (!cats().length) return R.host ? empty('Primero crea una categoría y agrega jugadores.', '<button class="btn" data-go="cats">Ir a Categorías</button>') : empty('Aún no hay categorías.');
  if (!R.host) return vMiAsistencia();
  const ps = players(U.lcat), a = (D.att && D.att.m) || {}, c = { P: 0, T: 0, A: 0 };
  ps.forEach(p => { if (a[p.id]) c[a[p.id]]++; });
  const mt = U.kind === 'Partido' ? list(D.matches).find(m => m.date === U.date && (!m.cat || m.cat === U.lcat)) : null;
  let h = `<select id="lc" style="margin-bottom:8px" aria-label="Categoría">${catOpts(U.lcat)}</select><div class="grid"><input type="date" id="d" value="${U.date}" aria-label="Fecha"><select id="k" aria-label="Tipo">${['Entrenamiento', 'Partido'].map(o => `<option${o === U.kind ? ' selected' : ''}>${o}</option>`).join('')}</select></div>`;
  if (mt) h += `<div class="mute" style="margin:-2px 0 6px">Partido vs ${esc(mt.rival)}</div>`;
  if (!ps.length) return h + empty('Esta categoría no tiene jugadores todavía.');
  h += `<div class="sum"><span style="color:var(--ok)">Presentes ${c.P}</span><span style="color:var(--late)">Tarde ${c.T}</span><span style="color:var(--no)">Ausentes ${c.A}</span><span class="mute">Sin marcar ${ps.length - c.P - c.T - c.A}</span></div>`;
  h += '<div class="chips quick"><button data-act="allP">✓ Todos presentes</button><button data-act="allClear">Limpiar</button></div>';
  ps.forEach(p => {
    const s = a[p.id];
    h += `<div class="card"><div class="row">${av(p)}<div class="grow"><div class="name">${esc(p.name)}</div><div class="mute">${esc(p.pos || '')}</div></div>${s ? `<span class="tag" style="background:${MK[s][1]}">${MK[s][0]}</span>` : ''}</div><div class="chips">` +
      ['P', 'T', 'A'].map(x => `<button class="${x}${s === x ? ' on' : ''}" data-act="mark" data-id="${p.id}" data-v="${x}">${MK[x][0]}</button>`).join('') + '</div></div>';
  });
  return h;
}
function vMiAsistencia() {
  const mp = myPlayer();
  if (!mp) return empty('Cuando el anfitrión te agregue al plantel, aquí verás tu asistencia.');
  const rows = list(D.attCat).filter(r => r.m && r.m[mp.id]).sort((a, b) => (a.date < b.date ? 1 : -1));
  const ym = thisMonth(), c = { P: 0, T: 0, A: 0 };
  rows.filter(r => r.date.startsWith(ym)).forEach(r => c[r.m[mp.id]]++);
  let h = `<h2>Tu asistencia</h2><div class="card"><div class="mute">${esc(monthName(ym))}</div><div class="sum big3"><span style="color:var(--ok)">Presente ${c.P}</span><span style="color:var(--late)">Tarde ${c.T}</span><span style="color:var(--no)">Ausente ${c.A}</span></div></div>`;
  if (!rows.length) return h + empty('Todavía no hay registros de asistencia.');
  h += '<div class="card">' + rows.slice(0, 30).map(r => { const s = r.m[mp.id]; return `<div class="row prow"><div class="grow"><div class="name">${esc(cap(fmtShort(r.date)))} · ${esc(r.kind)}</div></div><span class="tag" style="background:${MK[s][1]}">${MK[s][0]}</span></div>`; }).join('') + '</div>';
  return h;
}

// ── Pagos ───────────────────────────────────────────────────────────────────
export function vPagos() {
  if (!R.host) return vMisPagos();
  if (!cats().length) return empty('Primero crea una categoría y agrega jugadores.', '<button class="btn" data-go="cats">Ir a Categorías</button>');
  const ym = U.month;
  let ps = players().filter(p => (!U.pcat || p.cat === U.pcat) && (paidOf(p.id, ym) || !joinMonth(p) || ym >= joinMonth(p))).sort((a, b) => byName(cname(a.cat), cname(b.cat)) || byName(a.name, b.name));
  const paid = ps.filter(p => paidOf(p.id, ym)), n = paid.length, tot = ps.length;
  const got = paid.reduce((s, p) => s + feeOf(p.cat), 0), due = ps.filter(p => !paidOf(p.id, ym)).reduce((s, p) => s + feeOf(p.cat), 0);
  let h = `<div class="monthbar"><button data-act="mprev" aria-label="Mes anterior">‹</button><div class="mlabel">${esc(monthName(ym))}</div><button data-act="mnext" aria-label="Mes siguiente">›</button></div>`;
  h += catChips(U.pcat, 'pcat');
  h += `<div class="card paysum"><div class="row"><div class="grow"><div class="pbig"><b style="color:var(--ok)">${n}</b> de ${tot} pagaron</div>${got || due ? `<div class="mute">Recaudado <b class="okc">${money(got)}</b> · Falta <b class="noc">${money(due)}</b></div>` : '<div class="mute">Pon la cuota de cada categoría para ver el dinero.</div>'}</div><div class="pct">${tot ? Math.round(n * 100 / tot) : 0}%</div></div><div class="bar"><i style="width:${tot ? n * 100 / tot : 0}%"></i></div></div>`;
  h += `<div class="grid pf"><input id="pq" data-keep placeholder="Buscar jugador" value="${esc(U.pq)}" aria-label="Buscar"><select id="pfil" aria-label="Filtro"><option value="todos"${U.pfil === 'todos' ? ' selected' : ''}>Todos (${tot})</option><option value="no"${U.pfil === 'no' ? ' selected' : ''}>Pendientes (${tot - n})</option><option value="si"${U.pfil === 'si' ? ' selected' : ''}>Pagaron (${n})</option></select></div>`;
  const q = U.pq.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const shown = ps.filter(p => (U.pfil === 'todos' || (U.pfil === 'si') === !!paidOf(p.id, ym)) && (!q || p.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q)));
  if (!tot) return h + empty('No hay jugadores en esta categoría.');
  if (!shown.length) h += empty('Nadie coincide con el filtro.');
  shown.forEach(p => {
    const pd = paidOf(p.id, ym);
    h += `<div class="card payr${pd ? ' paid' : ''}"><button class="row grow pinfo" data-act="payhist" data-id="${p.id}">${av(p)}<div class="grow"><div class="name">${esc(p.name)}</div><div class="mute">${esc(cname(p.cat))}${feeOf(p.cat) ? ' · ' + money(feeOf(p.cat)) : ''}${pd ? ` · pagó ${esc(fmtShort(ymd(new Date(pd.t))))}${pd.by ? ' · ' + esc(firstName(pd.by)) : ''}` : ''}</div></div></button><button class="ptog${pd ? ' on' : ''}" data-act="pay" data-id="${p.id}" aria-pressed="${pd ? 'true' : 'false'}">${pd ? '✓ Pagó' : 'Pendiente'}</button></div>`;
  });
  h += `<button class="btn alt" data-act="sharepay" style="margin-top:6px">📤 Enviar lista de pendientes</button>`;
  return h;
}
function vMisPagos() {
  const mp = myPlayer();
  if (!mp) return empty('Cuando el anfitrión te agregue al plantel, aquí verás el estado de tus pagos.');
  const ym = thisMonth(), pd = paidOf(mp.id, ym), y = ym.slice(0, 4);
  let h = `<div class="card hero paystate ${pd ? 'ok' : 'no'}"><small>${esc(monthName(ym))}</small><div class="big">${pd ? 'Al día ✓' : 'Pendiente'}</div><small>${pd ? 'Pago registrado el ' + esc(fmtShort(ymd(new Date(pd.t)))) : feeOf(mp.cat) ? 'Cuota: ' + money(feeOf(mp.cat)) : 'El anfitrión registra los pagos.'}</small></div>`;
  h += `<h2>Pagos de ${y}</h2>` + yearGrid(mp, y, false) + '<div class="mute small center">✓ pagado · ✗ pendiente · – antes de entrar al club</div>';
  return h;
}
export const joinMonth = p => (p && p.t ? ymd(new Date(p.t)).slice(0, 7) : '');
export function yearGrid(p, y, edit) {
  const now = thisMonth(), since = joinMonth(p);
  let h = '<div class="ygrid">';
  for (let m = 1; m <= 12; m++) {
    const ym = y + '-' + String(m).padStart(2, '0'), pd = paidOf(p.id, ym), fut = ym > now, pre = since && ym < since;
    const cls = pd ? 'ok' : fut ? 'fut' : pre ? 'pre' : 'no', mark = pd ? '✓' : fut ? '·' : pre ? '–' : '✗';
    h += edit ? `<button class="ym ${cls}" data-act="payym" data-id="${p.id}" data-ym="${ym}">${monthShort(m)}<small>${mark}</small></button>` : `<div class="ym ${cls}">${monthShort(m)}<small>${mark}</small></div>`;
  }
  return h + '</div>';
}

// ── Personas (solo anfitriones) ─────────────────────────────────────────────
export function vPersonas() {
  const pend = pendingUsers(), all = users(), hosts = Object.keys(D.hosts);
  let h = `<div class="seg"><button class="${U.personas === 'nuevas' ? 'on' : ''}" data-act="pseg" data-id="nuevas">Nuevas (${pend.length})</button><button class="${U.personas === 'todas' ? 'on' : ''}" data-act="pseg" data-id="todas">Todas (${all.length})</button><button class="${U.personas === 'anf' ? 'on' : ''}" data-act="pseg" data-id="anf">Anfitriones (${hosts.length})</button></div>`;
  if (U.personas === 'nuevas') {
    h += '<div class="mute" style="margin:4px 0 10px">Personas que se registraron en la app y todavía no están en el plantel.</div>';
    if (!pend.length) return h + empty('No hay personas nuevas. Cuando alguien se registre aparecerá aquí.');
    pend.forEach(u => {
      const sug = nameMatch(u.name);
      h += `<div class="card"><div class="row">${uav(u, 'lg')}<div class="grow"><div class="name">${esc(u.name)}</div><div class="mute">Se registró ${esc(ago(u.t))}${u.cat && cname(u.cat) ? ' · Pidió ' + esc(cname(u.cat)) : ''}</div></div></div>
      ${sug ? `<div class="sugg">¿Es <b>${esc(sug.name)}</b> (${esc(cname(sug.cat))}) del plantel? <button class="btn sm" data-act="linkto" data-id="${u.id}" data-p="${sug.id}">Vincular</button></div>` : ''}
      <div class="chips"><button class="P on wide" data-act="approve" data-id="${u.id}">✓ Agregar al plantel</button><button data-act="linkuser" data-id="${u.id}">Vincular…</button><button data-act="notplayer" data-id="${u.id}">No es jugador</button></div></div>`;
    });
    return h;
  }
  if (U.personas === 'todas') {
    if (!all.length) return h + empty('Aún no se ha registrado nadie.');
    return h + all.map(u => {
      const p = playerOfUser(u.id);
      const info = isHostUser(u.id) ? 'Anfitrión' : p ? `${esc(cname(p.cat) || 'Sin categoría')}${p.num ? ' · #' + esc(p.num) : ''}` : u.np ? 'No es jugador' : 'Sin plantel';
      return `<button class="card row prow2" data-act="person" data-id="${u.id}">${uav(u)}<div class="grow"><div class="name">${esc(u.name)}${u.id === B.uid ? ' <span class="mute">(tú)</span>' : ''}</div><div class="mute">${info} · visto ${esc(ago(u.last || u.t))}</div></div><span class="chev">›</span></button>`;
    }).join('');
  }
  h += '<div class="mute" style="margin:4px 0 10px">Entraron con el código de anfitrión. Pueden cambiar todo en la app.</div>';
  return h + hosts.map(id => {
    const u = D.users[id] || { name: D.hosts[id].name || 'Anfitrión' };
    return `<div class="card row">${uav(u)}<div class="grow"><div class="name">${esc(u.name)}${id === B.uid ? ' <span class="mute">(tú)</span>' : ''}</div><div class="mute">Anfitrión desde ${esc(ago(D.hosts[id].t))}</div></div><button class="btn alt sm" data-act="unhost" data-id="${id}">${id === B.uid ? 'Dejar' : 'Quitar'}</button></div>`;
  }).join('');
}
