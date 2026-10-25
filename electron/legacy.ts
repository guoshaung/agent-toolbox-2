import { app, clipboard } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { LegacyScope, LegacyAction } from '../shared/types';

const allowed: Record<LegacyScope, Set<string>> = {
  system: new Set(['status', 'connect', 'copyText']),
  ai: new Set(['status', 'start', 'stop', 'refresh', 'test', 'update', 'copyKey']),
  drawing: new Set(['status', 'start', 'stop', 'qr']),
};
function directory() {
  // Tests must never read the real account/pairing directory.
  return !app.isPackaged &&
    (process.env.TOOLBOX2_TEST_LEGACY_DIR || process.env.TOOLBOX2_TEST_DATA_DIR)
    ? process.env.TOOLBOX2_TEST_LEGACY_DIR ||
        path.join(process.env.TOOLBOX2_TEST_DATA_DIR!, 'legacy-isolated')
    : path.join(app.getPath('appData'), 'agent-toolbox');
}
export async function legacyPreferences() {
  try {
    const config = JSON.parse(await fs.readFile(path.join(directory(), 'config.json'), 'utf8'));
    return {
      typography: ['system', 'q-headings', 'q-all', 'handwritten'].includes(config.ui?.typography)
        ? config.ui.typography
        : 'q-headings',
      scale: ['small', 'normal', 'large', 'xlarge'].includes(config.ui?.scale)
        ? config.ui.scale
        : 'normal',
    };
  } catch {
    return { typography: 'system', scale: 'normal' };
  }
}
async function invoke(scope: string, action: string, payload?: unknown) {
  const descriptor = JSON.parse(
    await fs.readFile(path.join(directory(), 'v2-bridge.json'), 'utf8'),
  );
  if (
    descriptor.protocol !== 1 ||
    !Number.isInteger(descriptor.port) ||
    descriptor.port < 1 ||
    descriptor.port > 65535 ||
    !/^[a-f0-9]{64}$/.test(descriptor.token)
  )
    throw Error('旧版桥接格式不兼容');
  const response = await fetch(`http://127.0.0.1:${descriptor.port}/invoke`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${descriptor.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope, action, payload }),
    signal: AbortSignal.timeout(action === 'test' ? 130000 : action === 'status' ? 4000 : 30000),
  });
  const value = await response.json();
  if (!response.ok || value.ok === false) throw Error(value.error || '旧版服务操作失败');
  if (scope === 'drawing' && value.desktopUrl) {
    const url = new URL(value.desktopUrl);
    if (url.origin !== 'http://127.0.0.1:43128' || url.pathname !== '/')
      throw Error('绘图服务地址不兼容');
  }
  return value;
}
let connecting: Promise<unknown> | undefined;
async function connect() {
  try {
    return await invoke('system', 'status');
  } catch {
    /* launch the installed owner */
  }
  if (process.env.TOOLBOX2_TEST_DATA_DIR || process.env.TOOLBOX2_TEST_LEGACY_DIR)
    throw Error('测试模式不会启动旧版应用');
  const executable = path.join(
    process.env.LOCALAPPDATA || '',
    'Programs',
    'agent-toolbox',
    'Agent 工具箱.exe',
  );
  try {
    await fs.access(executable);
  } catch {
    throw Error('未找到已安装的旧工具箱。请先安装兼容桥接，见仓库迁移说明。');
  }
  const child = spawn(executable, [], { detached: true, stdio: 'ignore', windowsHide: false });
  let launchError = false;
  child.on('error', () => {
    launchError = true;
  });
  child.unref();
  for (let i = 0; i < 32; i++) {
    if (launchError) throw Error('旧工具箱启动失败');
    await new Promise((resolve) => setTimeout(resolve, 400));
    try {
      return await invoke('system', 'status');
    } catch {}
  }
  throw Error('旧版服务暂未连接。请保持旧工具箱运行，并确认已安装 V2 兼容桥接。');
}
export async function legacyRequest(scope: LegacyScope, action: LegacyAction, payload?: unknown) {
  if (!Object.hasOwn(allowed, scope) || !allowed[scope].has(action))
    throw Error('不支持的迁移操作');
  if (JSON.stringify(payload ?? null).length > 14000) throw Error('操作内容过长');
  if (scope === 'system' && action === 'status') {
    const preferences = await legacyPreferences();
    try {
      return { ...(await invoke(scope, action)), connected: true };
    } catch {
      return { connected: false, preferences, message: '尚未连接旧版服务', protocol: 1 };
    }
  }
  if (scope === 'system' && action === 'copyText') {
    if (typeof payload !== 'string' || payload.length > 12000) throw Error('复制内容无效');
    clipboard.writeText(payload);
    return { copied: true };
  }
  if (scope === 'system' && action === 'connect') {
    if (!connecting)
      connecting = connect().finally(() => {
        connecting = undefined;
      });
    return { ...((await connecting) as object), connected: true };
  }
  try {
    return await invoke(scope, action, payload);
  } catch (error: any) {
    if (error.code === 'ENOENT' || error.cause?.code === 'ECONNREFUSED')
      throw Error('旧版服务已断开，请点击“连接现有工具箱”重连。');
    throw error;
  }
}
