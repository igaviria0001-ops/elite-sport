// Uniformes: el anfitrión elige qué uniforme se usa en cada entreno y partido, y todos lo ven.
// Simula el lunes 7 de diciembre: entreno martes (negro), miércoles (rojo) y partido sábado (negro).
import { chromium } from 'playwright';
import path from 'path';
import assert from 'node:assert/strict';
import { servir } from './servidor.mjs';
const AQUI = path.dirname(new globalThis.URL(import.meta.url).pathname), RAIZ = path.resolve(AQUI, '..');
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const parar = await servir(RAIZ, 8765);
const BASE = 'http://localhost:8765/', T = AQUI + '/img/', HOY = '2026-12-07';
const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const errs = [];
const ok = (c, m) => { assert.ok(c, m); console.log('  ✓ ' + m); };
const wait = (pg, fn, a, ms = 5000) => pg.waitForFunction(fn, a, { timeout: ms });
const tab = async (pg, t) => { await pg.bringToFront(); await pg.click(`nav [data-tab=${t}]`); await wait(pg, t => document.querySelector(`nav [data-tab=${t}]`).classList.contains('on'), t); };
async function open(who) { const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(who + ': ' + e.message)); pg.on('console', m => m.type() === 'error' && errs.push(who + ': ' + m.text())); await pg.goto(BASE + '?who=' + who + '&hoy=' + HOY); await pg.waitForSelector('#app .onb, nav button'); return pg; }
try {
  const H = await open('kh');
  await H.click('.gate .hostkey'); await H.fill('#hc', 'DEMO'); await H.click('.hostdlg [data-y]'); await H.waitForTimeout(300);
  await H.fill('#ob-name', 'Ana Gómez'); await H.click('[data-act=ob-save]'); await H.waitForSelector('nav button');
  await tab(H, 'cats'); await H.fill('#cn', 'Sub-13'); await H.click('[data-act=addcat]'); await H.waitForSelector('.cat');
  // Entrenos martes (negro) y miércoles (rojo) con la interfaz
  await tab(H, 'entreno');
  for (const [d, k, ty] of [['2026-12-08', 'Negro', 'Físico'], ['2026-12-09', 'Rojo', 'Táctico']]) {
    await H.fill('#td', d); await H.fill('#tt', '17:00'); await H.selectOption('#tc', { label: 'Sub-13' }); await H.selectOption('#ty', ty); await H.selectOption('#tk', k);
    await H.click('[data-act=savetrain]'); await H.waitForTimeout(200);
  }
  await wait(H, () => document.querySelectorAll('.tcard').length === 2);
  ok((await H.textContent('.tcard >> nth=0')).includes('Uniforme negro') && (await H.textContent('.tcard >> nth=1')).includes('Uniforme rojo'), 'el anfitrión eligió negro para el martes y rojo para el miércoles');
  await tab(H, 'partidos'); await H.fill('#mr', 'Camilo Torres'); await H.fill('#md', '2026-12-12'); await H.fill('#mt', '15:00'); await H.selectOption('#mc', { label: 'Sub-13' }); await H.selectOption('#mk', 'Negro'); await H.click('[data-act=savematch]');
  await H.waitForSelector('.mcard');
  ok((await H.textContent('.mcard')).includes('Uniforme negro'), 'partido del sábado con uniforme negro');
  await H.fill('#mr', 'Deportivo Sur'); await H.fill('#md', '2026-12-19'); await H.click('[data-act=savematch]'); await wait(H, () => document.querySelectorAll('.mcard').length === 2);
  ok((await H.textContent('.mcard:has-text("Deportivo")')).includes('por definir'), 'si no se elige, dice «Uniforme por definir»');

  // El jugador lo ve
  const J = await open('kj');
  await J.click('[data-act=ob-photo]'); await J.waitForSelector('.sheet [data-k=gal]');
  const [fc] = await Promise.all([J.waitForEvent('filechooser'), J.click('.sheet [data-k=gal]')]); await fc.setFiles(T + 'face2.jpg'); await J.click('.cropper [data-y]');
  await J.fill('#ob-name', 'Santiago Gómez'); await J.selectOption('#ob-cat', { label: 'Sub-13' }); await J.fill('#ob-tel', '3001112233'); await J.click('[data-act=ob-save]'); await J.waitForSelector('nav button');
  await tab(J, 'inicio');
  ok((await J.textContent('.hero:has-text("Próximo partido")')).includes('Uniforme negro'), 'Inicio · próximo partido: «Uniforme negro»');
  ok((await J.textContent('.tmini')).includes('Uniforme negro'), 'Inicio · próximo entreno (mañana): «Uniforme negro»');
  const ag = (await J.textContent('.kagenda')).replace(/\s+/g, ' ');
  ok(/Mañana.*Uniforme negro.*Mié 9 dic.*Uniforme rojo.*Sáb 12 dic.*Partido vs Camilo Torres.*Uniforme negro/.test(ag), '«¿Qué uniforme toca?»: ' + ag.slice(0, 160));
  ok((await J.textContent('.kitc.sel')).includes('Uniforme negro') && (await J.textContent('.kitc.sel')).includes('Próximo uso: Mañana'), 'la foto del uniforme negro se resalta: «Próximo uso: Mañana»');
  await J.evaluate(() => document.querySelector('.kagenda').scrollIntoView()); await J.screenshot({ path: '/tmp/elite-capturas-uniformes.png' });
  await tab(J, 'entreno');
  ok((await J.textContent('.tcard >> nth=0')).includes('Uniforme negro'), 'en Entreno cada tarjeta dice qué uniforme usar');
  ok(!(await J.$('#tk')), 'el jugador no puede cambiarlo');

  // El anfitrión cambia el miércoles a negro: le llega al jugador al instante
  await tab(H, 'entreno'); await H.click('.tcard:has-text("Táctico") [data-act=edittrain]');
  ok((await H.inputValue('#tk')) === 'Rojo', 'al editar, el uniforme ya viene puesto');
  await H.selectOption('#tk', 'Negro'); await H.click('[data-act=savetrain]');
  await J.bringToFront(); await wait(J, () => [...document.querySelectorAll('.tcard')].every(c => c.textContent.includes('Uniforme negro')));
  ok(true, 'el cambio le llega al jugador sin recargar');
} catch (e) { console.error('✗', e.message); process.exitCode = 1; }
console.log(errs.length ? errs.join('\n') : 'sin errores de consola');
await b.close(); parar();
