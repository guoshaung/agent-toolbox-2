import { spawn } from 'node:child_process';
import electron from 'electron';
await import('./build.mjs');
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit' });
let ready = false;
for (let i = 0; i < 40; i++) { try { await fetch('http://127.0.0.1:5174'); ready = true; break; } catch { await new Promise(r => setTimeout(r, 250)); } }
if (!ready) { vite.kill(); throw Error('Vite did not start'); }
const env = { ...process.env, VITE_DEV_SERVER_URL: 'http://127.0.0.1:5174' }; delete env.ELECTRON_RUN_AS_NODE;
const desktop = spawn(electron, ['.'], { stdio: 'inherit', env });
desktop.on('exit', () => { vite.kill(); process.exit(); });
process.on('SIGINT', () => { desktop.kill(); vite.kill(); });
