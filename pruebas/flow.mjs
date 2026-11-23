// Prueba completa en modo local: un anfitrión y dos jugadores en "aparatos" distintos
// (?who=...), mismo servidor simulado. Verifica sincronización en vivo y permisos.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import path from 'path';
import { servir } from './servidor.mjs';
const AQUI = path.dirname(new globalThis.URL(import.meta.url).pathname), RAIZ = path.resolve(AQUI, '..');
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const parar = await servir(RAIZ, 8765);


const URL = 'http://localhost:8765/';
const SHOTS = '/tmp/elite-capturas-';
const T = AQUI + '/img/';
const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errs = [];
let step = '';
async function open(who) {
  const pg = await ctx.newPage();
  pg.on('pageerror', e => errs.push(`[${who}] pageerror: ${e.message}`));
  pg.on('console', m => { if (m.type() === 'error') errs.push(`[${who}] ${m.text()}`); });
  await pg.goto(URL + '?who=' + who);
  await pg.waitForSelector('#app .onb, #app .card');
  return pg;
}
const shot = (pg, n, full = false) => pg.screenshot({ path: SHOTS + n + '.png', fullPage: full });
const text = pg => pg.textContent('#app');
async function wait(pg, fn, arg, ms = 4000) { await pg.waitForFunction(fn, arg, { timeout: ms }); }
const ok = (c, m) => { assert.ok(c, m); console.log('  ✓ ' + m); };

async function pickPhoto(pg, file, trigger) {
  await pg.click(trigger);
  await pg.waitForSelector('.sheet [data-k=gal]');
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('.sheet [data-k=gal]')]);
  await fc.setFiles(T + file);
  await pg.waitForSelector('.cropper canvas');
  // arrastrar y acercar un poco
  const box = await pg.locator('.cropper canvas').boundingBox();
  await pg.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await pg.mouse.down(); await pg.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 10); await pg.mouse.up();
  await pg.locator('.cropper input[type=range]').fill('1.3');
  await pg.click('.cropper [data-y]');
}
async function register(pg, name, file, cat) {
  if (file) await pickPhoto(pg, file, '[data-act=ob-photo]');
  await pg.fill('#ob-name', name);
  if (await pg.$('#ob-tel')) await pg.fill('#ob-tel', '300 111 2233');
  if (cat) await pg.selectOption('#ob-cat', { label: cat });
  await pg.click('[data-act=ob-save]');
  await pg.waitForSelector('nav button');
}
async function hostCode(pg, code) {
  await pg.click('[data-act=hostkey]');
  await pg.fill('#hc', code);
  await pg.click('.hostdlg [data-y]');
  await pg.waitForTimeout(250);
}
const tab = async (pg, t) => { await pg.click(`nav [data-tab=${t}]`); await pg.waitForFunction(t => document.querySelector(`nav [data-tab=${t}]`).classList.contains('on'), t); };

try {
  // ── 1. Registro del anfitrión ─────────────────────────────────────────────
  step = 'registro anfitrión';
  console.log('1. Registro y validación del nombre');
  const H = await open('host');
  await shot(H, '01-registro');
  for (const [bad, why] of [['Camilo', 'apellido'], ['Juan Puta', 'permitido'], ['Pedro 10 Ruiz', 'letras']]) {
    await H.fill('#ob-name', bad);
    await H.click('[data-act=ob-save]');
    const e = await H.textContent('#ob-err');
    ok(e.includes(why), `rechaza "${bad}" → ${e}`);
  }
  await H.fill('#ob-name', 'Carlos Ramírez');
  await H.click('[data-act=ob-save]');
  ok((await H.textContent('#ob-terr')).includes('celular'), 'sin celular del acudiente no deja entrar');
  await H.fill('#ob-tel', '12345'); await H.click('[data-act=ob-save]');
  ok((await H.textContent('#ob-terr')).includes('Revisa el número'), 'celular inválido: lo rechaza');
  await H.fill('#ob-tel', '300 111 2233');
  await H.click('[data-act=ob-save]');
  ok((await H.textContent('.toast')).includes('foto'), 'sin foto no deja entrar (jugador)');
  await register(H, 'carlos ramírez', 'face1.jpg');
  ok((await H.textContent('#role')).includes('Carlos'), 'entra con su nombre (con mayúsculas corregidas)');
  ok(!(await H.$('nav [data-tab=personas]')), 'todavía no es anfitrión: no ve Personas');
  await shot(H, '02-inicio-sin-rol');

  // ── 2. Código de anfitrión ────────────────────────────────────────────────
  step = 'código';
  console.log('2. Código de anfitrión');
  await hostCode(H, 'XXXX');
  ok((await H.textContent('.hmsg')).includes('4 intentos'), 'código incorrecto: quedan 4 intentos');
  await H.fill('#hc', 'DEMO'); await H.click('.hostdlg [data-y]');
  await H.waitForSelector('nav [data-tab=personas]');
  ok((await H.textContent('#role')).includes('ANFITRIÓN'), 'código correcto → anfitrión');

  // ── 3. Arma el club ───────────────────────────────────────────────────────
  step = 'categorías';
  console.log('3. Categorías, jugadores, cuota y alineación');
  await tab(H, 'cats');
  for (const c of ['Sub-13', 'Sub-15']) { await H.fill('#cn', c); await H.click('[data-act=addcat]'); await H.waitForTimeout(80); }
  await wait(H, () => document.querySelectorAll('.cat').length === 2);
  await H.click('.cat >> nth=0');
  await H.waitForSelector('#pn');
  const roster = [['Mateo Pérez', '1', 'Portero'], ['Samuel Rojas', '4', 'Defensa'], ['Juan Díaz', '8', 'Medio'], ['Andrés Torres', '10', 'Delantero']];
  for (const [n, num, pos] of roster) { await H.fill('#pn', n); await H.fill('#pm', num); await H.selectOption('#pp', pos); await H.click('[data-act=addplayer]'); await H.waitForTimeout(60); }
  await wait(H, () => document.querySelectorAll('.prow2').length === 4);
  ok(true, '4 jugadores agregados en Sub-13');
  await H.fill('#fee', '50000'); await H.press('#fee', 'Tab');
  await H.selectOption('#ft', 'Fútbol 7');
  await H.waitForTimeout(150);
  await H.click('.slot >> nth=0'); await H.click('.pick button >> text=Mateo');
  await H.click('.slot >> nth=1'); await H.click('.pick button >> text=Samuel');
  await H.waitForTimeout(150);
  ok((await H.locator('.slot:not(.empty-s)').count()) === 2, 'alineación con 2 jugadores');
  await shot(H, '03-categoria', true);

  // ── 4. Partido y entrenamiento ────────────────────────────────────────────
  step = 'partidos';
  console.log('4. Partidos y entrenamientos');
  await tab(H, 'partidos');
  await H.fill('#mr', 'Camilo Torres'); await H.fill('#mp', 'Cancha municipal');
  const d3 = new Date(Date.now() + 3 * 864e5), ds = d3.toISOString().slice(0, 10);
  await H.fill('#md', ds); await H.fill('#mt', '15:00');
  const [fc] = await Promise.all([H.waitForEvent('filechooser'), H.click('[data-act=mcrest]')]);
  await fc.setFiles(T + 'crest.png');
  await H.waitForSelector('.pickc img');
  await H.selectOption('#mc', { label: 'Sub-13' }); await H.selectOption('#mk', 'Rojo');
  await H.click('[data-act=savematch]');
  await H.waitForSelector('.mcard');
  ok((await H.inputValue('#mr')) === '', 'formulario se limpia al guardar');
  await H.fill('#mr', 'Deportivo Sur'); await H.fill('#md', new Date(Date.now() - 5 * 864e5).toISOString().slice(0, 10)); await H.click('[data-act=savematch]');
  await wait(H, () => document.querySelectorAll('.mcard').length === 2);
  await H.fill('.res', '3-1'); await H.press('.res', 'Tab');
  await H.waitForSelector('.rrow .tag');
  ok((await H.textContent('.rrow')).includes('Ganado'), 'marcador 3-1 → Ganado');
  await shot(H, '04-partidos', true);

  await tab(H, 'entreno');
  await H.fill('#td', new Date(Date.now() + 864e5).toISOString().slice(0, 10)); await H.fill('#tt', '17:00'); await H.fill('#tp', 'Cancha del barrio');
  await H.selectOption('#tc', { label: 'Sub-13' }); await H.selectOption('#ty', 'Táctico'); await H.fill('#tn', 'Salida desde atrás y presión alta');
  await H.selectOption('#tr', '4');
  await H.click('[data-act=savetrain]');
  await wait(H, () => document.querySelectorAll('.tcard').length === 4);
  ok(true, 'entrenamiento repetido 4 semanas');
  const [fc2] = await Promise.all([H.waitForEvent('filechooser'), H.click('[data-act=trainphotos] >> nth=0')]);
  await fc2.setFiles([T + 'train0.jpg', T + 'train1.jpg']);
  await wait(H, () => document.querySelectorAll('.tph img[src]').length === 2, null, 8000);
  ok(true, '2 fotos de entrenamiento subidas');
  await shot(H, '05-entreno');

  // ── 5. Un jugador se registra en otro aparato ─────────────────────────────
  step = 'jugador';
  console.log('5. Jugador en otro celular');
  const J = await open('j1');
  await shot(J, '06-registro-jugador');
  ok((await J.$$('#ob-cat option')).length === 3, 'el registro ya muestra las categorías creadas por el anfitrión');
  await register(J, 'Santiago Gómez', 'face2.jpg', 'Sub-13');
  ok((await text(J)).includes('El anfitrión te agregará'), 'jugador ve que su registro está pendiente');
  ok(!(await J.$('nav [data-tab=personas]')), 'jugador no ve Personas');
  ok((await text(J)).includes('Camilo Torres'), 'jugador ve el próximo partido');
  await tab(J, 'partidos');
  ok(!(await J.$('#mr')) && !(await J.$('[data-act=delmatch]')), 'jugador no puede crear ni borrar partidos');
  await tab(J, 'cats'); await J.click('.cat >> nth=0');
  ok(!(await J.$('#pn')) && !(await J.$('button.slot')), 'jugador ve la categoría sin poder editar');
  await shot(J, '07-cat-jugador', true);

  // Intento de escritura directa (como si alguien hackeara): el servidor la rechaza.
  const denied = await J.evaluate(async () => {
    const B = await import('./js/backend.js');
    try { await B.set('matches/hack', { rival: 'X', date: '2030-01-01' }, false); return false; } catch (e) { return e.code; }
  });
  ok(denied === 'permission-denied', 'escritura directa de un jugador → rechazada por las reglas');

  // ── 6. El anfitrión lo agrega al plantel (en vivo) ────────────────────────
  step = 'aprobar';
  console.log('6. Anfitrión aprueba y todo se ve en vivo');
  await tab(H, 'inicio');
  await H.waitForSelector('.alertc');
  ok((await H.textContent('nav [data-tab=personas]')).includes('1'), 'anfitrión ve 1 persona nueva (sin recargar)');
  await tab(H, 'personas');
  await shot(H, '08-personas');
  await H.click('[data-act=approve]');
  await H.fill('#ap-num', '7'); await H.selectOption('#ap-pos', 'Delantero');
  await H.click('.sheet [data-k=ok]');
  await J.bringToFront(); await tab(J, 'inicio');
  await J.waitForSelector('.ficha', { timeout: 4000 });
  ok((await J.textContent('.ficha')).includes('#7'), 'el jugador ve su ficha al instante (#7 Delantero)');
  ok((await J.textContent('.ficha')).includes('Pendiente'), 'pago del mes: Pendiente');

  // ── 7. Pagos ──────────────────────────────────────────────────────────────
  step = 'pagos';
  console.log('7. Pagos');
  await H.bringToFront(); await tab(H, 'pagos');
  await H.waitForSelector('.payr');
  ok((await H.textContent('.paysum')).includes('0 de 5'), 'resumen: 0 de 5 pagaron');
  await H.click('.payr:has-text("Santiago") .ptog');
  await H.click('.payr:has-text("Mateo") .ptog');
  await wait(H, () => document.querySelector('.paysum').textContent.includes('2 de 5'));
  ok((await H.textContent('.paysum')).includes('$100.000'), 'recaudado $100.000 (cuota $50.000)');
  await wait(J, () => document.querySelector('.ficha') && document.querySelector('.ficha').textContent.includes('Al día'));
  ok(true, 'el jugador ve "Al día ✓" sin recargar');
  await H.selectOption('#pfil', 'no');
  await wait(H, () => document.querySelectorAll('.payr').length === 3);
  ok(true, 'filtro Pendientes muestra 3');
  await H.selectOption('#pfil', 'todos');
  await H.fill('#pq', 'sant');
  await wait(H, () => document.querySelectorAll('.payr').length === 1 && document.activeElement.id === 'pq');
  ok(true, 'buscar "sant" → 1 jugador y el cursor sigue en el buscador');
  await H.fill('#pq', '');
  await H.selectOption('#pfil', 'todos');
  await H.click('.payr:has-text("Juan") .pinfo');
  await H.waitForSelector('.sheet .ygrid');
  await H.click('.sheet .ym >> nth=0');
  await H.waitForTimeout(150);
  ok((await H.locator('.sheet .ym.ok').count()) === 1, 'historial: marcar enero desde la hoja');
  await shot(H, '09-historial');
  await H.click('.sheet [data-close]');
  await H.waitForTimeout(250);
  await shot(H, '10-pagos', true);
  await J.bringToFront(); await tab(J, 'pagos');
  await J.waitForSelector('.paystate');
  ok((await text(J)).includes('Al día'), 'jugador ve sus pagos');
  ok(!(await text(J)).includes('Mateo'), 'jugador NO ve los pagos de los demás');
  const peek = await J.evaluate(async () => {
    const B = await import('./js/backend.js');
    return new Promise(r => B.watchCol('pay', () => r('leyó'), null, e => r(e.code)));
  });
  ok(peek === 'permission-denied', 'leer todos los pagos directamente → rechazado');
  await shot(J, '11-pagos-jugador');

  // ── 8. Asistencia ─────────────────────────────────────────────────────────
  step = 'asistencia';
  console.log('8. Asistencia');
  await H.bringToFront(); await tab(H, 'lista');
  await H.waitForSelector('[data-act=allP]');
  await H.click('[data-act=allP]');
  await wait(H, () => document.querySelector('.sum').textContent.includes('Presentes 5'));
  await H.click('.card:has-text("Santiago") [data-v=T]');
  await wait(H, () => document.querySelector('.sum').textContent.includes('Tarde 1'));
  ok(true, 'todos presentes + Santiago tarde');
  await shot(H, '12-lista');
  await J.bringToFront(); await tab(J, 'lista');
  await wait(J, () => document.querySelector('.big3') && document.querySelector('.big3').textContent.includes('Tarde 1'));
  ok(true, 'jugador ve su asistencia (Tarde 1)');
  await shot(J, '13-asistencia-jugador');

  // ── 9. Límite de intentos del código ──────────────────────────────────────
  step = 'bloqueo';
  console.log('9. Límite de intentos');
  for (let i = 0; i < 5; i++) { if (i === 0) await J.click('[data-act=profile]'), await J.click('.sheet [data-k=host]'); await J.fill('#hc', 'AB' + i + 'Z'); await J.click('.hostdlg [data-y]'); await J.waitForTimeout(150); }
  ok((await J.textContent('.hmsg')).includes('espera'), 'tras 5 intentos fallidos se bloquea: ' + (await J.textContent('.hmsg')));
  ok(await J.isDisabled('#hc'), 'el campo queda bloqueado');
  await shot(J, '14-bloqueo');
  await J.click('.hostdlg [data-n]');
  await J.reload(); await J.waitForSelector('nav button');
  await J.click('[data-act=profile]'); await J.click('.sheet [data-k=host]');
  ok((await J.textContent('.hmsg')).includes('espera'), 'el bloqueo sigue después de recargar');
  await J.click('.hostdlg [data-n]');

  // ── 10. Sesión guardada ───────────────────────────────────────────────────
  step = 'sesión';
  console.log('10. La sesión queda guardada');
  await H.reload(); await H.waitForSelector('nav [data-tab=personas]');
  ok((await H.textContent('#role')).includes('ANFITRIÓN'), 'anfitrión sigue siéndolo tras recargar (no pide código)');
  ok(!(await H.$('.onb')), 'no vuelve a pedir el registro');

  // ── 11. Quitar rol / borrar persona ───────────────────────────────────────
  step = 'segundo anfitrión';
  console.log('11. Segundo anfitrión y revocación');
  const H2 = await open('host2');
  await register(H2, 'Laura Méndez', 'face3.jpg');
  await H2.click('.foot [data-act=hostkey]'); await H2.fill('#hc', 'DEMO'); await H2.click('.hostdlg [data-y]');
  await H2.waitForSelector('nav [data-tab=personas]');
  await H.bringToFront(); await tab(H, 'personas'); await H.click('.seg [data-id=anf]');
  await wait(H, () => document.querySelectorAll('[data-act=unhost]').length === 2);
  await H.click('.card:has-text("Laura") [data-act=unhost]'); await H.click('.veil [data-y]');
  await wait(H2, () => !document.querySelector('nav [data-tab=personas]'), null, 5000);
  ok(!(await H2.textContent('#role')).includes('ANFITRIÓN'), 'al quitarle el rol, Laura deja de ser anfitriona en vivo');
  await shot(H, '15-anfitriones');

  // ── 12. Perfil ────────────────────────────────────────────────────────────
  step = 'perfil';
  await J.bringToFront(); await J.click('[data-act=profile]');
  await J.waitForSelector('#pf-name');
  await shot(J, '16-perfil');
  await J.click('.sheet [data-close]');
} catch (e) {
  console.error('✗ FALLÓ en «' + step + '»:', e.message);
  for (const p of ctx.pages()) await p.screenshot({ path: SHOTS + 'fail-' + ctx.pages().indexOf(p) + '.png' });
  process.exitCode = 1;
}
console.log(errs.length ? 'Errores de consola:\n' + errs.join('\n') : 'Sin errores de consola');
await b.close(); parar();
