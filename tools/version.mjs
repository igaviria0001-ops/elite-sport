// Marca una versión nueva de la app. Ejecutar SIEMPRE antes de publicar:
//   node tools/version.mjs
// Calcula una huella de todos los archivos de la app y la escribe en:
//   version.json      → lo que la app consulta para saber si hay versión nueva
//   js/version.js     → la versión que trae el código que está corriendo
//   sw.js             → nombre de la copia sin internet (para que se renueve)
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SKIP = new Set(['version.json', 'js/version.js']);
const files = [];
function walk(dir) {
  for (const n of fs.readdirSync(path.join(ROOT, dir))) {
    if (n.startsWith('.') || ['tools', 'node_modules', 'pruebas'].includes(n)) continue;
    const rel = dir ? dir + '/' + n : n;
    const st = fs.statSync(path.join(ROOT, rel));
    if (st.isDirectory()) walk(rel);
    else if (!SKIP.has(rel) && !/\.(md)$/i.test(n)) files.push(rel);
  }
}
walk('');
files.sort();
const h = crypto.createHash('sha256');
for (const f of files) {
  let data = fs.readFileSync(path.join(ROOT, f));
  if (f === 'sw.js') data = Buffer.from(String(data).replace(/const VERSION = '[^']*';/, "const VERSION = '';"));
  h.update(f + '\0').update(data);
}
const v = h.digest('hex').slice(0, 10);
const fecha = new Date().toISOString();
fs.writeFileSync(path.join(ROOT, 'version.json'), JSON.stringify({ v, fecha }) + '\n');
fs.writeFileSync(path.join(ROOT, 'js/version.js'), `// Generado por tools/version.mjs: no editar a mano.\nexport const VERSION = '${v}';\n`);
const sw = path.join(ROOT, 'sw.js');
fs.writeFileSync(sw, String(fs.readFileSync(sw)).replace(/const VERSION = '[^']*';/, `const VERSION = 'elite-sport-${v}';`));
console.log('Versión', v, '·', files.length, 'archivos');
