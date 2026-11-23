// Recordatorios de pago: franja y aviso para quien debe, WhatsApp para el anfitrión,
// desaparece al registrar el pago, plazo, mes sin cobro y mensaje propio.
// Usa ?hoy=AAAA-MM-DD (solo en modo de pruebas) para simular el día 2 y el día 9 del mes.
import { chromium } from 'playwright';
import path from 'path';
import assert from 'node:assert/strict';
import { servir } from './servidor.mjs';
const AQUI = path.dirname(new globalThis.URL(import.meta.url).pathname), RAIZ = path.resolve(AQUI, '..');
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const parar = await servir(RAIZ, 8765);
const BASE = 'http://localhost:8765/', T = AQUI + '/img/';
const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const errs = [];
const ok = (c, m) => { assert.ok(c, m); console.log('  ✓ ' + m); };
const wait = (pg, fn, a, ms = 5000) => pg.waitForFunction(fn, a, { timeout: ms });
const tab = async (pg, t) => { await pg.bringToFront(); await pg.click(`nav [data-tab=${t}]`); await wait(pg, t => document.querySelector(`nav [data-tab=${t}]`).classList.contains('on'), t); };
async function open(who, hoy) { const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(who + ': ' + e.message)); pg.on('console', m => m.type() === 'error' && errs.push(who + ': ' + m.text())); await pg.goto(BASE + '?who=' + who + '&hoy=' + hoy); await pg.waitForSelector('#app .onb, nav button'); return pg; }
const spy = pg => pg.evaluate(() => { window.__opened = []; window.open = u => { window.__opened.push(u); return {}; }; try { delete navigator.share; } catch (e) {} Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); });
const opened = pg => pg.evaluate(() => window.__opened.map(decodeURIComponent));
try {
  const H = await open('ph', '2026-12-02');
  await H.click('.gate .hostkey'); await H.fill('#hc', 'DEMO'); await H.click('.hostdlg [data-y]'); await H.waitForTimeout(300);
  await H.fill('#ob-name', 'Ana Gómez'); await H.click('[data-act=ob-save]'); await H.waitForSelector('nav button');
  await H.evaluate(async () => {
    const B = await import('./js/backend.js');
    await B.set('cats/c1', { name: 'Sub-13', fmt: 'Fútbol 7', form: '2-3-1', lineup: {}, fee: 50000, t: 1 }, false);
    await B.set('players/q1', { name: 'Mateo Pérez', num: '1', pos: 'Portero', cat: 'c1', t: Date.parse('2026-12-01T12:00:00') }, false);
  });
  const J = await open('pj', '2026-12-02');
  await J.click('[data-act=ob-photo]'); await J.waitForSelector('.sheet [data-k=gal]');
  const [fc] = await Promise.all([J.waitForEvent('filechooser'), J.click('.sheet [data-k=gal]')]); await fc.setFiles(T + 'face2.jpg'); await J.click('.cropper [data-y]');
  await J.fill('#ob-name', 'Santiago Gómez'); await J.selectOption('#ob-cat', { label: 'Sub-13' });
  ok(!!(await J.$('#ob-tel')), 'el registro pide el celular del acudiente');
  await J.fill('#ob-tel', '320 555 6677'); await J.click('[data-act=ob-save]'); await J.waitForSelector('nav button');
  ok(!(await J.$('.paybar')), 'antes de estar en el plantel no hay aviso de pago');

  // El anfitrión lo aprueba con el WhatsApp del acudiente
  await tab(H, 'personas');
  ok((await H.textContent('.card:has-text("Santiago")')).includes('+57 320 555 6677'), 'el anfitrión ve el celular que puso el acudiente al registrarse');
  await H.click('.card:has-text("Santiago") [data-act=approve]');
  ok((await H.inputValue('#ap-tel')) === '+57 320 555 6677', 'al aprobarlo, el celular ya viene puesto');
  await H.click('.sheet [data-k=ok]'); await H.waitForTimeout(250);
  await H.evaluate(async () => { const B = await import('./js/backend.js'); const { D } = await import('./js/state.js'); const id = Object.keys(D.players).find(k => D.players[k].name === 'Santiago Gómez'); await B.update('players/' + id, { t: Date.parse('2026-12-01T12:00:00') }); });

  // Jugador: franja visible en todas las pantallas + aviso grande una vez al día
  await J.bringToFront();
  await J.waitForSelector('.paybar', { timeout: 6000 });
  ok((await J.textContent('.paybar')).includes('Recuerda pagar la cuota de diciembre · $50.000 · hasta el 5'), 'franja: «' + (await J.textContent('.paybar')).trim() + '»');
  await J.waitForSelector('.paypop', { timeout: 4000 });
  ok((await J.textContent('.paypop')).includes('Recordatorio de pago'), 'al abrir aparece el aviso grande de pago');
  await J.screenshot({ path: '/tmp/elite-capturas-pago-aviso.png' });
  await J.click('.paypop .btn');
  await tab(J, 'partidos'); ok(!!(await J.$('.paybar')), 'la franja sigue visible en Partidos');
  await tab(J, 'entreno'); ok(!!(await J.$('.paybar')), 'y en Entreno');
  ok(!!(await J.$('nav [data-tab=pagos] .dot')), 'la pestaña Pagos tiene un punto de aviso');
  await J.screenshot({ path: '/tmp/elite-capturas-pago-franja.png' });
  await J.reload(); await J.waitForSelector('.paybar'); await J.waitForTimeout(1500);
  ok(!(await J.$('.paypop')), 'el aviso grande no se repite el mismo día');

  // Anfitrión: tarjeta del 1 al 5, envío por WhatsApp
  await tab(H, 'inicio'); await H.waitForSelector('.remc');
  ok((await H.textContent('.remc')).includes('Recordatorios de pago · diciembre'), 'el anfitrión ve «Recordatorios de pago · diciembre» en Inicio');
  await spy(H);
  await H.click('.remc'); await H.waitForSelector('.sheet [data-k=group]');
  await H.waitForTimeout(450); await H.screenshot({ path: '/tmp/elite-capturas-pago-recordar.png' });
  await H.click('.sheet button[data-k=one]:has-text("Enviar a Santiago")');
  let o = await opened(H);
  ok(o[0] && o[0].startsWith('https://wa.me/573205556677?text='), 'abre el WhatsApp que puso el acudiente: ' + o[0].slice(0, 40));
  ok(o[0].includes('*Santiago Gómez*') && o[0].includes('diciembre') && o[0].includes('$50.000') && o[0].includes('5 de diciembre'), 'mensaje: ' + o[0].split('text=')[1]);
  await wait(H, () => document.querySelector('.sheet') && document.querySelector('.sheet').textContent.includes('recordado'));
  ok(true, 'queda marcado «✓ recordado» y avanza al siguiente');
  // Mateo no tiene número: pedirlo y enviar
  await H.click('.sheet .rrow2:has-text("Mateo") [data-k=tel]'); await H.fill('#tel', '123'); await H.click('.sheet:last-of-type [data-k=ok]');
  ok((await H.textContent('#tel-err')).includes('válido'), 'número inválido: lo rechaza');
  await H.fill('#tel', '3109876543'); await H.click('.sheets [data-k=ok], .veil:last-child [data-k=ok]');
  await wait(H, () => document.querySelector('.sheet') && document.querySelector('.sheet').textContent.includes('+57 310 987 6543'));
  ok(true, 'número de Mateo guardado (+57 310 987 6543)');
  await H.click('.sheet [data-k=group]'); o = await opened(H);
  ok(o[o.length - 1].includes('Pendientes (2)') && o[o.length - 1].includes('Mateo Pérez'), 'mensaje al grupo con la lista de pendientes');
  await H.click('.sheet [data-close]'); await H.waitForTimeout(300);

  // Mensaje propio
  await tab(H, 'pagos'); await H.click('[data-act=remind]'); await H.click('.sheet [data-k=msg]');
  await H.fill('#msg', 'Buenas, falta la cuota de {mes} de {jugador}{valor}.');
  await H.click('.veil:last-child [data-k=ok]'); await H.waitForTimeout(250);
  await spy(H); await H.click('.sheet .rrow2:has-text("Mateo") [data-k=one]'); o = await opened(H);
  ok(o[0].includes('Buenas, falta la cuota de diciembre de Mateo Pérez ($50.000).'), 'usa el mensaje propio del anfitrión');
  await H.click('.sheet [data-close]'); await H.waitForTimeout(300);

  // Registrar el pago: el aviso desaparece en vivo
  await H.click('.payr:has-text("Santiago") .ptog');
  await J.bringToFront(); await wait(J, () => !document.querySelector('.paybar'));
  ok(!(await J.$('nav [data-tab=pagos] .dot')), 'al marcar «Pagó», la franja y el punto desaparecen al instante');
  await tab(J, 'pagos'); ok((await J.textContent('#app')).includes('Al día'), 'su pantalla de pagos dice «Al día ✓»');

  // Día 9: vencido
  await H.bringToFront(); await H.click('.payr:has-text("Santiago") .ptog'); await H.waitForTimeout(300);
  const J9 = await open('pj', '2026-12-09');
  await J9.waitForSelector('.paybar.late', { timeout: 6000 });
  ok((await J9.textContent('.paybar')).includes('vencido'), 'después del plazo: «' + (await J9.textContent('.paybar')).trim() + '» (en rojo)');
  await J9.close();
  const H9 = await open('ph', '2026-12-09'); await tab(H9, 'inicio'); await H9.waitForSelector('.remc.late');
  ok((await H9.textContent('.remc')).includes('vencidos'), 'el anfitrión ve los pagos vencidos en Inicio');
  // Plazo configurable
  await H9.click('.remc'); await H9.selectOption('#rm-due', '10'); await H9.waitForTimeout(300); await H9.click('.sheet [data-close]'); await H9.waitForTimeout(300);
  await wait(H9, () => document.querySelector('.remc') && !document.querySelector('.remc.late'));
  ok(true, 'con plazo hasta el 10, el día 9 ya no aparece como vencido');
  await H9.close();

  // El anfitrión puede cambiar el número (gana el más reciente)
  await tab(H, 'cats'); await H.click('.cat'); await H.click('.prow2:has-text("Santiago")'); await H.fill('#ep-tel', '311 000 1122'); await H.click('.sheet [data-k=save]'); await H.waitForTimeout(300);
  await spy(H); await tab(H, 'pagos'); await H.click('.payr:has-text("Santiago") .wab'); o = await opened(H);
  ok(o[0].startsWith('https://wa.me/573110001122'), 'si el anfitrión lo cambia, se usa el número nuevo');

  // Quien se registró antes (reglas viejas, sin celular) ve el pedido del número
  const K = await open('pk&viejas', '2026-12-02');
  await K.fill('#ob-name', 'Laura Méndez');
  ok(!(await K.$('#ob-tel')), 'con las reglas viejas el registro no pide el celular (no falla)');
  await K.click('[data-act=ob-photo]'); await K.waitForSelector('.sheet [data-k=gal]');
  const [fk] = await Promise.all([K.waitForEvent('filechooser'), K.click('.sheet [data-k=gal]')]); await fk.setFiles(T + 'face3.jpg'); await K.click('.cropper [data-y]');
  await K.click('[data-act=ob-save]'); await K.waitForSelector('nav button'); await K.close();
  const K2 = await open('pk', '2026-12-02'); await tab(K2, 'inicio');
  await K2.waitForSelector('.telc', { timeout: 5000 });
  ok(true, 'ya con las reglas nuevas, en Inicio le aparece «Falta el celular del acudiente»');
  await K2.waitForSelector('.sheet #tp-tel', { timeout: 5000 });
  ok(true, 'y una ventana para escribirlo');
  await K2.fill('#tp-tel', '315 222 3344'); await K2.click('.sheet [data-k=ok]');
  await wait(K2, () => !document.querySelector('.telc'));
  ok(true, 'al guardarlo, el aviso desaparece');
  await tab(H, 'personas'); await H.click('.seg [data-id=nuevas]');
  ok((await H.textContent('.card:has-text("Laura")')).includes('+57 315 222 3344'), 'el anfitrión ve el número de Laura');

  // Mes sin cobro
  await tab(H, 'pagos'); await H.click('.foot [data-act=freemonth]'); await H.click('.veil [data-y]');
  await J.bringToFront(); await wait(J, () => !document.querySelector('.paybar'));
  ok(true, 'mes marcado «no se cobra»: nadie ve aviso');
} catch (e) { console.error('✗', e.message); process.exitCode = 1; }
console.log(errs.length ? errs.join('\n') : 'sin errores de consola');
await b.close(); parar();
