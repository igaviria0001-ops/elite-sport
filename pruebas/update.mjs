// Simula publicar una versión nueva mientras la app está abierta.
import { chromium } from 'playwright';
import fs from 'fs';
import { execSync } from 'child_process';
import assert from 'node:assert/strict';
import path from 'path';
import { servir } from './servidor.mjs';
const AQUI = path.dirname(new globalThis.URL(import.meta.url).pathname), RAIZ = path.resolve(AQUI, '..');
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';

const SITE = '/tmp/elite-upd-site', URL = 'http://localhost:8766/?who=u1';
fs.rmSync(SITE, { recursive: true, force: true }); fs.cpSync(RAIZ, SITE, { recursive: true, filter: f => !f.includes('/.git') });
const parar = await servir(SITE, 8766);
const ok = (c, m) => { assert.ok(c, m); console.log('  ✓ ' + m); };
const dir = '/tmp/es-upd-profile'; fs.rmSync(dir, { recursive: true, force: true });
const ctx = await chromium.launchPersistentContext(dir, { executablePath: CHROME, args: ['--no-sandbox'], viewport: { width: 390, height: 844 } });
const pg = ctx.pages()[0];
const errs = []; pg.on('pageerror', e => errs.push(e.message));
const bump = () => { fs.appendFileSync(SITE + '/css/app.css', '\n/* ' + Date.now() + ' */\n'); return execSync('node tools/version.mjs', { cwd: SITE }).toString().trim().split(' ')[1]; };
try {
  await pg.goto(URL); await pg.waitForSelector('.onb');
  await pg.click('.gate .hostkey'); await pg.fill('#hc', 'DEMO'); await pg.click('.hostdlg [data-y]'); await pg.waitForTimeout(300);
  await pg.fill('#ob-name', 'Carlos Ramírez'); await pg.click('[data-act=ob-save]'); await pg.waitForSelector('nav [data-tab=personas]');
  await pg.click('nav [data-tab=cats]'); await pg.fill('#cn', 'Sub-13'); await pg.click('[data-act=addcat]'); await pg.waitForSelector('.cat');
  const v0 = await pg.evaluate(async () => (await import('./js/version.js')).VERSION);
  console.log('versión abierta:', v0);

  // 1) Publico versión nueva mientras escribe: NO debe recargar
  await pg.click('nav [data-tab=partidos]'); await pg.fill('#mr', 'Rival a medio escribir');
  const v1 = bump(); console.log('publicada:', v1);
  await pg.evaluate(() => { window.__marca = 1; window.__esCheckUpdate(); });
  await pg.waitForTimeout(5000);
  ok(await pg.evaluate(() => window.__marca === 1), 'con un formulario a medio llenar NO recarga (no se pierde lo escrito)');
  // 2) Termina de escribir y guarda → se actualiza sola
  await pg.click('[data-act=savematch]');
  await pg.waitForFunction(() => !window.__marca, null, { timeout: 15000 }).catch(() => {});
  await pg.waitForSelector('nav button', { timeout: 15000 });
  const v2 = await pg.evaluate(async () => (await import('./js/version.js')).VERSION);
  ok(v2 === v1, 'al guardar, se recargó sola con la versión nueva (' + v2 + ')');
  await pg.waitForSelector('.toast', { timeout: 4000 }); ok((await pg.textContent('.toast')).includes('actualizada'), 'avisa «App actualizada ✓»');
  ok((await pg.textContent('#role')).includes('ANFITRIÓN'), 'sigue con la sesión y como anfitrión (sin pedir código)');
  await pg.click('nav [data-tab=partidos]'); ok((await pg.textContent('#app')).includes('Rival a medio escribir'), 'el partido guardado sigue ahí');
  await pg.click('nav [data-tab=cats]'); ok((await pg.textContent('#app')).includes('Sub-13'), 'las categorías siguen ahí');

  // 3) En segundo plano: se actualiza en cuanto se oculta
  const v3 = bump();
  await pg.evaluate(() => { window.__marca = 2; window.__esCheckUpdate(); });
  await pg.waitForFunction(() => !window.__marca, null, { timeout: 15000 });
  await pg.waitForSelector('nav button');
  ok((await pg.evaluate(async () => (await import('./js/version.js')).VERSION)) === v3, 'tercera versión aplicada sin intervención');

  // 4) Otra app del dominio borra localStorage de anfitrión → se recupera de IndexedDB
  await pg.evaluate(() => localStorage.removeItem('es_u1_hk'));
  await pg.reload(); await pg.waitForSelector('nav button');
  ok((await pg.textContent('#role')).includes('ANFITRIÓN'), 'si se borra la marca de anfitrión del aparato, se recupera sola');

  // 5) Otra app del dominio borra todas las copias sin internet → se rehace
  await pg.evaluate(async () => { for (const k of await caches.keys()) await caches.delete(k); });
  await pg.reload(); await pg.waitForSelector('nav button'); await pg.waitForTimeout(7000);
  const n = await pg.evaluate(async () => { const ks = await caches.keys(); let t = 0; for (const k of ks) t += (await (await caches.open(k)).keys()).length; return [ks, t]; });
  ok(n[1] >= 20, 'la copia sin internet se rehízo sola (' + n[1] + ' archivos en ' + n[0].join(',') + ')');
  await ctx.setOffline(true); await pg.reload(); await pg.waitForSelector('nav button', { timeout: 8000 });
  ok(true, 'y abre sin internet');
  await ctx.setOffline(false);

  // 6) Recarga sin bucle si el servidor todavía entrega la versión vieja
  fs.writeFileSync(SITE + '/version.json', JSON.stringify({ v: 'zzzzzzzzzz' }));
  await pg.evaluate(() => { window.__marca = 3; window.__esCheckUpdate(); });
  await pg.waitForFunction(() => !window.__marca, null, { timeout: 15000 }); await pg.waitForSelector('nav button');
  await pg.evaluate(() => { window.__marca = 4; window.__esCheckUpdate(); }); await pg.waitForTimeout(4000);
  ok(await pg.evaluate(() => window.__marca === 4), 'sin bucles: si la versión nueva aún no llega, no recarga una y otra vez');
} catch (e) { console.error('✗', e.message); process.exitCode = 1; }
console.log(errs.join('\n') || 'sin errores');
await ctx.close(); parar();
