import { defineConfig } from 'vite';
export default defineConfig({ base: './', build: { outDir: 'dist', target: 'chrome130' }, plugins: [{ name: 'local-dev-websocket', apply: 'serve', transformIndexHtml: html => html.replace("connect-src 'self'", "connect-src 'self' ws://127.0.0.1:5174") }], server: { host: '127.0.0.1', port: 5174, strictPort: true } });
