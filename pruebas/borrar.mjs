// Borrar cuentas: un probador se borra a sí mismo y un anfitrión borra a otra persona,
// y no deben quedar rastros en ninguna sección.
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
const tab = async (pg, t) => { await pg.bringToFront(); await pg.click(`nav [data-tab=${t}]`); await pg.waitForFunction(t => document.querySelector(`nav [data-tab=${t}]`).classList.contains('on'), t); };
async function open(who) { const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(who + ': ' + e.message)); pg.on('console', m => m.type() === 'error' && errs.push(who + ': ' + m.text())); await pg.goto(BASE + '?who=' + who); await pg.waitForSelector('#app .onb'); return pg; }
async function register(pg, name, foto, host) {
  if (host) { await pg.click('.gate .hostkey'); await pg.fill('#hc', 'DEMO'); await pg.click('.hostdlg [data-y]'); await pg.waitForTimeout(300); }
  if (foto) { await pg.click('[data-act=ob-photo]'); await pg.waitForSelector('.sheet [data-k=gal]'); const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('.sheet [data-k=gal]')]); await fc.setFiles(T + foto); await pg.click('.cropper [data-y]'); }
  await pg.fill('#ob-name', name); if (await pg.$('#ob-tel')) await pg.fill('#ob-tel', '3001112233'); await pg.click('[data-act=ob-save]'); await pg.waitForSelector('nav button');
}
const db = pg => pg.evaluate(() => JSON.parse(localStorage.getItem('esl_db') || '{}'));
try {
  const H = await open('bh'); await register(H, 'Ana Gómez', null, true);
  await H.evaluate(async () => { const B = await import('./js/backend.js'); await B.set('cats/c1', { name: 'Sub-13', fmt: 'Fútbol 7', form: '2-3-1', lineup: {}, fee: 50000, t: 1 }, false); });
  const J = await open('bj'); await register(J, 'Santiago Gómez', 'face2.jpg');
  const P = await open('bt'); await register(P, 'Tomás Herrera', 'face1.jpg', true);
  const tuid = await P.evaluate(async () => (await import('./js/backend.js')).uid);
  const juid = await J.evaluate(async () => (await import('./js/backend.js')).uid);
  // El probador se agrega al plantel, aprueba a Santiago, crea un partido, marca pagos y se pone en la alineación
  await tab(P, 'personas'); await P.click('.seg [data-id=todas]'); await P.click('.prow2:has-text("Tomás")'); await P.click('.sheet [data-k=add]'); await P.click('.sheet [data-k=ok]'); await P.waitForTimeout(200);
  await P.click('.seg [data-id=nuevas]'); await P.click('.card:has-text("Santiago") [data-act=approve]'); await P.click('.sheet [data-k=ok]'); await P.waitForTimeout(200);
  await tab(P, 'partidos'); await P.fill('#mr', 'Camilo Torres'); await P.click('[data-act=savematch]'); await P.waitForSelector('.mcard');
  await tab(P, 'pagos'); await P.click('.payr:has-text("Tomás") .ptog'); await P.click('.payr:has-text("Santiago") .ptog'); await P.waitForTimeout(200);
  await tab(P, 'cats'); await P.click('.cat'); await P.click('.slot >> nth=0'); await P.click('.pick button >> text=Tomás'); await P.waitForTimeout(200);
  let d = await db(P);
  ok(Object.keys(d).some(k => k.startsWith('log/') && d[k].w === 'Tomás Herrera'), 'antes: el registro tiene entradas de Tomás');

  // 1) Tomás se borra a sí mismo
  await P.click('[data-act=profile]'); await P.click('.sheet [data-k=wipe]'); await P.click('.veil [data-y]');
  await P.waitForSelector('#app .onb', { timeout: 10000 });
  ok(true, 'Tomás borró su cuenta y su celular vuelve a la pantalla de registro');
  d = await db(P);
  ok(!d['users/' + tuid], 'ya no está en Personas (perfil borrado)');
  ok(!Object.keys(d).some(k => k.startsWith('players/') && d[k].uid === tuid) && !Object.values(d).some(v => v && v.name === 'Tomás Herrera'), 'ya no está en el plantel');
  ok(!Object.keys(d).some(k => k.startsWith('hostkeys/') && k.endsWith('/' + tuid)), 'ya no es anfitrión');
  ok(!Object.keys(d).some(k => k.startsWith('log/') && (d[k].w === 'Tomás Herrera' || String(d[k].x).includes('Tomás'))), 'el registro no lo nombra');
  ok(!JSON.stringify(d).includes('Tomás'), 'su nombre no aparece en ningún dato del club');
  ok(!d['tels/' + tuid], 'su celular también se borró');
  ok(Object.keys(d).some(k => k.startsWith('matches/') && d[k].rival === 'Camilo Torres'), 'el partido que creó sigue para el club');
  const jp = Object.keys(d).find(k => k.startsWith('players/') && d[k].uid === juid);
  ok(jp && d['pay/' + jp.split('/')[1]], 'el pago de Santiago que marcó Tomás se conserva (sin su nombre)');
  ok(await P.evaluate(() => { const me = JSON.parse(localStorage.getItem('es_bt_me') || 'null'); return !localStorage.getItem('es_bt_hk') && !(me && me.p); }), 'su celular ya no guarda perfil ni marca de anfitrión');
  await tab(H, 'personas'); await H.click('.seg [data-id=todas]');
  ok(!(await H.textContent('#app')).includes('Tomás'), 'el otro anfitrión ya no lo ve en Personas');
  await tab(H, 'cats'); await H.click('.cat');
  ok(!(await H.textContent('#app')).includes('Tomás'), 'ni en la categoría ni en la alineación');

  // 2) Ana (anfitriona) borra a Santiago por completo
  await tab(H, 'personas'); await H.click('.seg [data-id=todas]'); await H.click('.prow2:has-text("Santiago")'); await H.click('.sheet [data-k=del]'); await H.click('.veil [data-y]');
  await J.bringToFront(); await J.waitForSelector('#app .onb', { timeout: 8000 });
  ok(true, 'Santiago, borrado por la anfitriona, vuelve a la pantalla de registro');
  d = await db(H);
  ok(!JSON.stringify(d).includes('Santiago'), 'Santiago no aparece en ningún dato (perfil, ficha, pagos ni registro)');
  ok(!d['tels/' + juid], 'ni su celular');
} catch (e) { console.error('✗', e.message); process.exitCode = 1; }
console.log(errs.length ? errs.join('\n') : 'sin errores de consola');
await b.close(); parar();
