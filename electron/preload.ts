import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopBridge } from '../shared/types';
const bridge: DesktopBridge = {
  request: (route, body) => ipcRenderer.invoke('workspace:request', route, body),
  window: (action) => ipcRenderer.send('workspace:window', action),
  openExternal: (url) => ipcRenderer.invoke('workspace:external', url),
  exportList: (content, name) => ipcRenderer.invoke('workspace:export', content, name),
  version: () => ipcRenderer.invoke('workspace:version'),
};
contextBridge.exposeInMainWorld('toolbox2', bridge);
