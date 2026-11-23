// Sirve una carpeta en un puerto local para las pruebas (usa python3 -m http.server).
import { spawn } from 'child_process';
export async function servir(dir, port) {
  const p = spawn('python3', ['-m', 'http.server', String(port)], { cwd: dir, stdio: 'ignore' });
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(`http://localhost:${port}/`); if (r.ok) break; } catch (e) {}
    await new Promise(r => setTimeout(r, 150));
  }
  return () => p.kill();
}
