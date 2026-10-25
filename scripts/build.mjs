import { build } from 'esbuild';
await Promise.all([
  build({ entryPoints: ['electron/main.ts'], bundle: true, platform: 'node', format: 'cjs', target: 'node20', outfile: 'dist-electron/main.cjs', external: ['electron'] }),
  build({ entryPoints: ['electron/preload.ts'], bundle: true, platform: 'node', format: 'cjs', target: 'node20', outfile: 'dist-electron/preload.cjs', external: ['electron'] }),
  build({ entryPoints: ['backend/service.ts'], bundle: true, platform: 'node', format: 'cjs', target: 'node20', outfile: 'dist-electron/service.cjs' })
]);
