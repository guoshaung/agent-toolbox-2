'use strict';
// Applies only exact, known source anchors. No credential or configuration edits.
function replace(source, before, after) {
  if (!source.includes(before)) throw Error('旧版代码不匹配，已停止；未安装任何变更');
  return source.replace(before, after);
}
function patchLegacy(files) {
  const out = { ...files };
  if (out['main.js'].includes("require('./v2-bridge')")) {
    if (
      !out['ai-hub.js'].includes('return bridgeActions[name](payload)') ||
      !out['drawing-sync.js'].includes('return bridgeActions[name](payload)')
    )
      throw Error('旧版桥接不完整，已停止');
    return out;
  }
  out['ai-hub.js'] = replace(
    out['ai-hub.js'],
    "  ipcMain.handle('aiHub:status'",
    "  const bridgeActions = {};\n  const handle = (name, action) => { bridgeActions[name] = action; ipcMain.handle(name, secure(action)); };\n  handle('aiHub:status'",
  );
  // Keep the existing secure wrapper for original IPC; remember the underlying
  // actions for the authenticated controller in the same main process.
  out['ai-hub.js'] = out['ai-hub.js'].replace(
    /(?:ipcMain\.handle|handle)\('(aiHub:[^']+)', secure\(([\s\S]*?)\)\);/g,
    "handle('$1', $2);",
  );
  out['ai-hub.js'] = replace(
    out['ai-hub.js'],
    "  app.on('before-quit', () => { closeLogin(); service?.loginCancel(); service?.stop().catch(() => {}); });",
    "  app.on('before-quit', () => { closeLogin(); service?.loginCancel(); service?.stop().catch(() => {}); });\n  return (name, payload) => { if (!Object.hasOwn(bridgeActions, name)) throw Error('未知操作'); return bridgeActions[name](payload); };",
  );
  out['drawing-sync.js'] = replace(
    out['drawing-sync.js'],
    '  const handle = (channel, action) => ipcMain.handle(channel, async (event, payload) => {',
    '  const bridgeActions = {};\n  const handle = (channel, action) => { bridgeActions[channel] = action; ipcMain.handle(channel, async (event, payload) => {',
  );
  out['drawing-sync.js'] = replace(
    out['drawing-sync.js'],
    "    if (!valid(event)) throw Error('仅工具箱本地界面可管理绘图连接'); return action(payload);\n  });",
    "    if (!valid(event)) throw Error('仅工具箱本地界面可管理绘图连接'); return action(payload);\n  }); };",
  );
  out['drawing-sync.js'] = replace(
    out['drawing-sync.js'],
    "  app.on('before-quit', () => { service?.stop().catch(() => {}); });",
    "  app.on('before-quit', () => { service?.stop().catch(() => {}); });\n  return (name, payload) => { if (!Object.hasOwn(bridgeActions, name)) throw Error('未知操作'); return bridgeActions[name](payload); };",
  );
  out['main.js'] = replace(
    out['main.js'],
    "const { registerAiHubIpc } = require('./ai-hub');",
    "const { registerAiHubIpc } = require('./ai-hub');\nconst { startBridge } = require('./v2-bridge');",
  );
  out['main.js'] = replace(
    out['main.js'],
    '  registerDrawingIpc(ipcMain, { app });',
    '  const v2Drawing = registerDrawingIpc(ipcMain, { app });',
  );
  out['main.js'] = replace(
    out['main.js'],
    '  registerAiHubIpc(ipcMain, { app, safeStorage, clipboard, currentApi:',
    '  const v2Ai = registerAiHubIpc(ipcMain, { app, safeStorage, clipboard, currentApi:',
  );
  out['main.js'] = replace(
    out['main.js'],
    '  registerContainerIpc(ipcMain,',
    "  startBridge({ directory: app.getPath('userData'), ai: v2Ai, drawing: v2Drawing, clipboard, version: app.getVersion(),\n    preferences: () => ({ typography: store.get('ui.typography', 'q-headings'), scale: store.get('ui.scale', 'normal') }),\n  }).then(bridge => app.on('before-quit', () => bridge.close())).catch(() => console.error('[v2 bridge] 本机桥接启动失败'));\n  registerContainerIpc(ipcMain,",
  );
  if ((out['ai-hub.js'].match(/handle\('aiHub:/g) || []).length !== 17)
    throw Error('旧版通道注册数量不匹配');
  return out;
}
module.exports = { patchLegacy };
