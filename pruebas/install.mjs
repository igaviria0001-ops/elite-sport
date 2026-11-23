// Comprueba con las herramientas internas de Chrome que la app sea instalable.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { servir } from './servidor.mjs';
const AQUI = path.dirname(new globalThis.URL(import.meta.url).pathname), RAIZ = path.resolve(AQUI, '..');
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const parar = await servir(RAIZ, 8765);

const dir = '/tmp/es-profile'; fs.rmSync(dir, { recursive: true, force: true });
const ctx = await chromium.launchPersistentContext(dir, { executablePath: CHROME, args: ['--no-sandbox'], viewport: { width: 390, height: 844 } });
const b = { close: () => ctx.close() };
const pg = ctx.pages()[0] || await ctx.newPage();
const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.goto('http://localhost:8765/?who=inst');
await pg.waitForSelector('#app .onb');
const sw = await pg.evaluate(async () => { const r = await navigator.serviceWorker.ready; return r.active && r.active.state; });
console.log('service worker:', sw);
const cdp = await ctx.newCDPSession(pg);
const man = await cdp.send('Page.getAppManifest');
console.log('manifest:', man.url, 'errores:', man.errors.length ? man.errors : 'ninguno');
await pg.waitForTimeout(1500);
const ins = await cdp.send('Page.getInstallabilityErrors');
console.log('instalabilidad:', ins.installabilityErrors.length ? ins.installabilityErrors : 'INSTALABLE ✓');
// recarga sin red: abre desde la copia guardada
await ctx.setOffline(true);
await pg.reload(); await pg.waitForSelector('#app .onb, #app .card', { timeout: 8000 }).then(() => console.log('abre sin internet ✓')).catch(() => console.log('no abre sin internet ✗'));
console.log(errs.join('\n') || 'sin errores');
await b.close(); parar();
