// Casos extra: editar partido/entreno, borrar categoría en cascada, código antes del registro,
// persona borrada vuelve al registro, cambio de formación conserva la alineación.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import path from 'path';
import { servir } from './servidor.mjs';
const AQUI = path.dirname(new globalThis.URL(import.meta.url).pathname), RAIZ = path.resolve(AQUI, '..');
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const parar = await servir(RAIZ, 8765);

const URL = 'http://localhost:8765/', T = AQUI + '/img/';
const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const errs = [];
const ok = (c, m) => { assert.ok(c, m); console.log('  ✓ ' + m); };
async function open(who) { const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(who + ': ' + e.message)); pg.on('console', m => m.type() === 'error' && errs.push(who + ': ' + m.text())); await pg.goto(URL + '?who=' + who); await pg.waitForSelector('#app .onb'); return pg; }
const tab = async (pg, t) => { await pg.click(`nav [data-tab=${t}]`); await pg.waitForFunction(t => document.querySelector(`nav [data-tab=${t}]`).classList.contains('on'), t); };
const wait = (pg, fn, a) => pg.waitForFunction(fn, a, { timeout: 4000 });
try {
  const H = await open('x1');
  // Código desde la llave de la esquina, antes de registrarse
  await H.click('.gate .hostkey'); await H.fill('#hc', 'demo'); await H.click('.hostdlg [data-y]');
  await H.waitForFunction(() => document.querySelector('.gs').textContent.includes('anfitrión'));
  ok((await H.inputValue('#hc').catch(() => '')) === '', 'código en minúsculas se acepta (se convierte a mayúsculas)');
  await H.fill('#ob-name', 'Laura Méndez'); await H.click('[data-act=ob-save]');
  await H.waitForSelector('nav [data-tab=personas]');
  ok(true, 'anfitrión puede entrar sin foto');
  await H.evaluate(async () => {
    const B = await import('./js/backend.js');
    await B.set('cats/a', { name: 'Sub-11', fmt: 'Fútbol 7', form: '2-3-1', lineup: { 0: 'q0', 1: 'q1', 3: 'q2' }, t: 1 }, false);
    for (let i = 0; i < 3; i++) await B.set('players/q' + i, { name: 'Jugador Prueba' + 'abc'[i], num: String(i + 1), pos: 'Medio', cat: 'a', t: 1 }, false);
    await B.set('pay/q0', { m: { '2026-11': { t: 1, by: 'x', v: 0 } } });
  });
  // Cambio de formación conserva jugadores
  await tab(H, 'cats'); await H.click('.cat'); await H.selectOption('#fm', '3-2-1');
  await wait(H, () => document.querySelectorAll('.slot:not(.empty-s)').length === 3);
  ok(true, 'cambiar formación (misma cantidad) conserva los 3 jugadores');
  await H.selectOption('#ft', 'Fútbol 5');
  await wait(H, () => document.querySelectorAll('.slot').length === 5);
  ok((await H.locator('.slot:not(.empty-s)').count()) === 3, 'cambiar a Fútbol 5 conserva los que caben');
  // Partido: crear y editar
  await tab(H, 'partidos');
  await H.fill('#mr', 'Rival Uno'); await H.click('[data-act=savematch]');
  await H.waitForSelector('[data-act=editmatch]');
  await H.click('[data-act=editmatch]');
  ok((await H.inputValue('#mr')) === 'Rival Uno' && (await H.textContent('.ftitle')) === 'Editar partido', 'editar partido rellena el formulario');
  await H.fill('#mr', 'Rival Dos'); await H.fill('#mp', 'Estadio'); await H.click('[data-act=savematch]');
  await wait(H, () => document.querySelector('.mcard').textContent.includes('Rival Dos') && document.querySelectorAll('.mcard').length === 1);
  ok((await H.textContent('.ftitle')) === 'Nuevo partido' && (await H.inputValue('#mr')) === '', 'guardar edición: un solo partido y formulario limpio');
  // Entreno: editar
  await tab(H, 'entreno'); await H.fill('#tp', 'Coliseo'); await H.click('[data-act=savetrain]');
  await H.waitForSelector('[data-act=edittrain]'); await H.click('[data-act=edittrain]');
  ok((await H.inputValue('#tp')) === 'Coliseo', 'editar entreno rellena el formulario');
  await H.selectOption('#ty', 'Porteros'); await H.click('[data-act=savetrain]');
  await wait(H, () => document.querySelector('.tcard').textContent.includes('Porteros') && document.querySelectorAll('.tcard').length === 1);
  ok(true, 'entreno editado (tipo Porteros)');
  // Persona borrada vuelve al registro
  const J = await open('x2');
  await J.click('[data-act=ob-photo]'); await J.waitForSelector('.sheet [data-k=gal]');
  const [fc] = await Promise.all([J.waitForEvent('filechooser'), J.click('.sheet [data-k=gal]')]); await fc.setFiles(T + 'face2.jpg');
  await J.click('.cropper [data-y]'); await J.fill('#ob-name', 'Pedro Páramo'); await J.click('[data-act=ob-save]'); await J.waitForSelector('nav button');
  await H.bringToFront(); await tab(H, 'personas'); await H.click('.seg [data-id=todas]');
  await H.click('.prow2:has-text("Pedro")'); await H.click('.sheet [data-k=del]'); await H.click('.veil [data-y]');
  await J.bringToFront(); await J.waitForSelector('.onb', { timeout: 5000 });
  ok(true, 'persona borrada por el anfitrión vuelve a la pantalla de registro');
  // Borrar categoría en cascada
  await H.bringToFront(); await tab(H, 'cats'); await H.click('.cat'); await H.click('[data-act=delcat]'); await H.click('.veil [data-y]');
  await H.waitForTimeout(300);
  const left = await H.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('esl_db'))).filter(k => /^(players|pay|cats)\//.test(k)));
  ok(left.length === 0, 'borrar categoría borra sus jugadores y pagos');
} catch (e) { console.error('✗', e.message); process.exitCode = 1; }
console.log(errs.length ? errs.join('\n') : 'sin errores de consola');
await b.close(); parar();
