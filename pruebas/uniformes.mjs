// Uniformes: cada jugador elige el suyo tocándolo; el anfitrión ve cuántos y quiénes.
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
async function open(who) { const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(who + ': ' + e.message)); pg.on('console', m => m.type() === 'error' && errs.push(who + ': ' + m.text())); await pg.goto(BASE + '?who=' + who); await pg.waitForSelector('#app .onb, nav button'); return pg; }
async function reg(pg, name, foto) {
  await pg.click('[data-act=ob-photo]'); await pg.waitForSelector('.sheet [data-k=gal]');
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('.sheet [data-k=gal]')]); await fc.setFiles(T + foto); await pg.click('.cropper [data-y]');
  await pg.fill('#ob-name', name); if (await pg.$('#ob-tel')) await pg.fill('#ob-tel', '3001112233'); await pg.click('[data-act=ob-save]'); await pg.waitForSelector('nav button');
}
const kitN = (pg, id) => pg.evaluate(id => { const c = document.querySelector(`.kitc[data-id=${id}] .kitn b`); return c ? +c.textContent : -1; }, id);
try {
  const H = await open('uh');
  await H.click('.gate .hostkey'); await H.fill('#hc', 'DEMO'); await H.click('.hostdlg [data-y]'); await H.waitForTimeout(300);
  await H.fill('#ob-name', 'Ana Gómez'); await H.click('[data-act=ob-save]'); await H.waitForSelector('nav button');
  const J = await open('uj'); await reg(J, 'Santiago Gómez', 'face2.jpg');
  const K = await open('uk'); await reg(K, 'Valentina Ríos', 'face3.jpg');
  await tab(J, 'inicio');
  ok((await J.textContent('#app')).includes('¿Cuál uniforme quieres?'), 'el jugador ve «¿Cuál uniforme quieres? Tócalo para elegirlo»');
  await J.click('.kitc[data-id=red] .name');
  await J.waitForSelector('.kitc.sel[data-id=red]');
  ok((await J.textContent('.kitc[data-id=red] .kitn')).includes('Tu elección'), 'al tocar el rojo queda marcado «✓ Tu elección»');
  await J.screenshot({ path: '/tmp/elite-capturas-uniforme-jugador.png', fullPage: true });
  await J.click('.kitc[data-id=black] .zm'); await J.waitForSelector('.veil.zoom');
  ok(!(await J.$('.kitc.sel[data-id=black]')), 'la lupa solo amplía la foto (no cambia la elección)');
  await J.click('.veil.zoom');
  await tab(K, 'inicio'); await K.click('.kitc[data-id=black] .name'); await K.waitForSelector('.kitc.sel[data-id=black]');
  await tab(H, 'inicio');
  await wait(H, () => document.querySelector('.kitc[data-id=red] .kitn b') && document.querySelector('.kitc[data-id=red] .kitn b').textContent === '1' && document.querySelector('.kitc[data-id=black] .kitn b').textContent === '1');
  ok(true, 'el anfitrión ve al instante: rojo 1 · negro 1');
  await H.click('.kitc[data-id=red] .name'); await H.waitForSelector('.sheet .rrow2');
  ok((await H.textContent('.sheet')).includes('Santiago Gómez'), 'al tocar el rojo ve quién lo eligió (Santiago)');
  await H.waitForTimeout(300); await H.screenshot({ path: '/tmp/elite-capturas-uniforme-anfitrion.png' });
  await H.click('.sheet [data-close]'); await H.waitForTimeout(250);
  // Cambia de opinión
  await J.bringToFront(); await J.click('.kitc[data-id=black] .name'); await J.waitForSelector('.kitc.sel[data-id=black]');
  await H.bringToFront(); await wait(H, () => document.querySelector('.kitc[data-id=red] .kitn b').textContent === '0' && document.querySelector('.kitc[data-id=black] .kitn b').textContent === '2');
  ok(true, 'si cambia a negro, el conteo se actualiza (rojo 0 · negro 2)');
  // Reglas viejas: no se guarda y avisa
  const V = await open('uv&viejas'); await reg(V, 'Pedro Páramo', 'face1.jpg');
  await tab(V, 'inicio'); await V.click('.kitc[data-id=red] .name');
  await wait(V, () => document.querySelector('.toast') && document.querySelector('.toast').textContent.includes('actualice'));
  ok(true, 'con reglas viejas avisa que falta actualizar y no queda marcado');
  await wait(V, () => !document.querySelector('.kitc.sel'));
} catch (e) { console.error('✗', e.message); process.exitCode = 1; }
console.log(errs.length ? errs.join('\n') : 'sin errores de consola');
await b.close(); parar();
