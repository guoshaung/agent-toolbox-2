import { app, BrowserWindow, ipcMain, utilityProcess, shell, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { ApiPath } from '../shared/types';

app.setName('Agent Toolbox 2 Preview');
app.setPath('userData', !app.isPackaged && process.env.TOOLBOX2_TEST_DATA_DIR ? process.env.TOOLBOX2_TEST_DATA_DIR : path.join(app.getPath('appData'), 'AgentToolbox2Preview'));
let window: BrowserWindow | null = null;
let backend: Electron.UtilityProcess | null = null;
let connection: { port: number; token: string } | null = null;
const routes = new Set<ApiPath>(['/workspace', '/health', '/search', '/visit', '/annotation', '/preferences', '/libraries']);
const getRoutes = new Set(['/workspace', '/health']);
async function startBackend() {
  const child = utilityProcess.fork(path.join(__dirname, 'service.cjs'), [app.getPath('userData')], { stdio: 'pipe', serviceName: 'Toolbox 2 Workspace' });
  backend = child;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('本地工作区启动超时')), 20000);
    child.once('exit', () => { connection = null; clearTimeout(timer); reject(Error('本地工作区已停止')); });
    child.on('message', message => {
      if (message?.type === 'ready') { clearTimeout(timer); connection = { port: message.port, token: message.token }; resolve(); }
      if (message?.type === 'error') { clearTimeout(timer); reject(Error(message.message)); }
    });
  });
}
async function request(route: ApiPath, body?: unknown) {
  if (!routes.has(route)) throw Error('不支持的工作区操作');
  if (!connection) throw Error('本地工作区未连接，请重启预览版');
  if (body && JSON.stringify(body).length > 250000) throw Error('请求内容过长');
  const response = await fetch(`http://127.0.0.1:${connection.port}${route}`, {
    method: getRoutes.has(route) ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${connection.token}`, 'Content-Type': 'application/json' },
    body: getRoutes.has(route) ? undefined : JSON.stringify(body || {}), signal: AbortSignal.timeout(28000),
  });
  const result = await response.json() as any;
  if (!response.ok) throw Error(result.error || '工作区请求失败'); return result;
}
function trusted(event: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent) {
  if (!window || event.sender.id !== window.webContents.id || event.senderFrame !== window.webContents.mainFrame) throw Error('无效的应用窗口');
}
ipcMain.handle('workspace:request', (event, route, body) => { trusted(event); return request(route, body); });
ipcMain.handle('workspace:version', event => { trusted(event); return app.getVersion(); });
ipcMain.handle('workspace:external', async (event, value) => {
  trusted(event); const url = new URL(String(value)); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw Error('仅支持网页链接'); await shell.openExternal(url.toString());
});
ipcMain.handle('workspace:export', async (event, content, name) => {
  trusted(event); if (typeof content !== 'string' || content.length > 1000000) throw Error('导出内容过大');
  const filename = String(name || '阅读清单').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').slice(0, 80);
  const result = await dialog.showSaveDialog(window!, { defaultPath: `${filename}.md`, filters: [{ name: 'Markdown', extensions: ['md'] }] });
  if (result.canceled || !result.filePath) return false; await fs.writeFile(result.filePath, content, 'utf8'); return true;
});
ipcMain.on('workspace:window', (event, action) => {
  trusted(event); if (action === 'minimize') window?.minimize(); if (action === 'maximize') window?.isMaximized() ? window.unmaximize() : window?.maximize(); if (action === 'close') window?.close();
});
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window?.isMinimized()) window.restore(); window?.show(); window?.focus(); });
  app.whenReady().then(async () => {
    await startBackend();
    window = new BrowserWindow({ width: 1536, height: 980, minWidth: 1000, minHeight: 700, frame: false, backgroundColor: '#10151c', show: false, autoHideMenuBar: true, title: 'Agent Toolbox 2 · 科研工作台', icon: path.join(__dirname, '../assets/icon.ico'), webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false } });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
    window.once('ready-to-show', () => window?.show());
    if (!app.isPackaged && process.env.VITE_DEV_SERVER_URL === 'http://127.0.0.1:5174') await window.loadURL(process.env.VITE_DEV_SERVER_URL);
    else await window.loadFile(path.join(__dirname, '../dist/index.html'));
  }).catch(error => { dialog.showErrorBox('Toolbox 2 预览版', String(error.message)); app.quit(); });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => { backend?.kill(); backend = null; connection = null; });
}
