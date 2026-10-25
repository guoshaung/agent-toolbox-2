const { app, BrowserWindow } = require('electron');
const fs = require('node:fs/promises'),
  path = require('node:path'),
  os = require('node:os');
const { startBridge } = require('../compat/legacy-bridge.cjs');
(async () => {
  const root = path.resolve(__dirname, '..');
  const data = await fs.mkdtemp(path.join(os.tmpdir(), 'toolbox2-migration-ui-'));
  const legacyDir = path.join(data, 'legacy');
  await fs.mkdir(legacyDir);
  const config = JSON.stringify({
    ui: { typography: 'handwritten', scale: 'xlarge' },
    ai: { keyEncrypted: 'existing-encrypted-test-fixture' },
  });
  const pairing = JSON.stringify({ token: 'existing-test-pairing' });
  await fs.writeFile(path.join(legacyDir, 'config.json'), config);
  await fs.writeFile(path.join(legacyDir, 'pairing.json'), pairing);
  const stats = { completed: 12, failures: 1, inputTokens: 0, outputTokens: 0, usageResponses: 0 };
  const hub = {
    running: true,
    baseUrl: 'http://127.0.0.1:18878/v1',
    inflight: 0,
    requests: [],
    channels: [
      {
        id: 'workbuddy-fixture',
        name: 'WorkBuddy 国内版',
        source: 'workbuddy-cn',
        provider: 'workbuddy',
        model: 'minimax-m3.1-flash',
        models: ['minimax-m3.1-flash', 'another-model'],
        priority: 10,
        enabled: true,
        ready: true,
        hasKey: true,
        cooldownUntil: 0,
        stats,
        quota: {
          remaining: 1280,
          unit: 'credits',
          source: 'api',
          updatedAt: new Date().toISOString(),
        },
      },
      {
        id: 'trae-fixture',
        name: 'TRAE 国际版 IDE',
        source: 'trae-ide',
        provider: 'trae',
        model: 'deepseek-v3.2',
        models: ['deepseek-v3.2'],
        priority: 60,
        enabled: true,
        ready: true,
        hasKey: true,
        cooldownUntil: 0,
        stats,
        quota: {
          plan: '测试套餐',
          source: 'api',
          updatedAt: new Date().toISOString(),
          windows: [{ label: '5 小时', usedPercent: 20 }],
        },
      },
    ],
  };
  let updates = 0;
  const bridge = await startBridge({
    directory: legacyDir,
    version: 'fixture',
    clipboard: { writeText() {} },
    preferences: () => ({ typography: 'handwritten', scale: 'xlarge' }),
    ai: async (action, payload) => {
      if (action === 'aiHub:save') {
        Object.assign(
          hub.channels.find((c) => c.id === payload.id),
          payload,
        );
        updates++;
      }
      if (action === 'aiHub:stop') hub.running = false;
      if (action === 'aiHub:start') hub.running = true;
      return hub;
    },
    drawing: async () => ({
      enabled: false,
      identity: { id: 'existing-device', code: '1234', name: 'Existing desktop' },
      clients: 0,
      remoteClients: 0,
      sequence: 320,
      desktopUrl: '',
      urls: [],
    }),
  });
  process.env.TOOLBOX2_TEST_DATA_DIR = data;
  process.env.TOOLBOX2_TEST_LEGACY_DIR = legacyDir;
  require('../dist-electron/main.cjs');
  const checks = [];
  let win, error;
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const check = (name, ok) => {
    checks.push({ name, ok: !!ok });
    if (!ok) throw Error(name);
  };
  try {
    for (let i = 0; i < 80; i++) {
      win = BrowserWindow.getAllWindows()[0];
      if (
        win &&
        !win.webContents.isLoading() &&
        (await win.webContents
          .executeJavaScript(`!!document.querySelector('.primary-nav')`)
          .catch(() => false))
      )
        break;
      await delay(200);
    }
    const evaluate = (code) => win.webContents.executeJavaScript(code);
    win.show();
    await delay(700);
    check(
      'original font preference is read without writing',
      await evaluate(
        `document.documentElement.dataset.typography==='handwritten'&&document.documentElement.dataset.legacyScale==='xlarge'`,
      ),
    );
    await evaluate(`document.querySelectorAll('.primary-nav button')[1].click()`);
    await delay(500);
    check(
      'quota page shows existing accounts and original model',
      await evaluate(
        `document.querySelectorAll('.channel-card').length===2&&document.querySelector('.channel-routing').textContent.includes('minimax-m3.1-flash')`,
      ),
    );
    check(
      'different quota formats render without aggregating credits',
      await evaluate(
        `document.querySelector('.quota-number').textContent.includes('1,280')&&document.querySelector('.quota-window strong').textContent.includes('20%')`,
      ),
    );
    await fs.mkdir(path.join(root, 'docs/screenshots'), { recursive: true });
    await delay(400);
    await evaluate(`document.documentElement.dataset.typography='system'`);
    await fs.writeFile(
      path.join(root, 'docs/screenshots/quota-demo.png'),
      (await win.webContents.capturePage()).toPNG(),
    );
    await evaluate(`document.documentElement.dataset.typography='handwritten'`);
    await evaluate(`document.querySelectorAll('.channel-actions button')[1].click()`);
    await delay(100);
    await evaluate(
      `const s=document.querySelector('.channel-editor select');s.value='another-model';s.dispatchEvent(new Event('change',{bubbles:true}))`,
    );
    await delay(80);
    await evaluate(
      `document.querySelector('.channel-editor form,form.channel-editor').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))`,
    );
    await delay(300);
    check(
      'model selection updates the original service through bounded IPC',
      updates === 1 && hub.channels[0].model === 'another-model',
    );
    await evaluate(`document.querySelector('.gateway-top>.button').click()`);
    await delay(200);
    check('gateway control uses the existing owner', hub.running === false);
    await evaluate(`document.querySelectorAll('.primary-nav button')[2].click()`);
    await delay(400);
    check(
      'drawing page preserves device identity and notebook operation count',
      await evaluate(
        `document.querySelector('.device-label').textContent.includes('1234')&&document.querySelector('.drawing-connection').textContent.includes('320')`,
      ),
    );
    check(
      'pairing QR is collapsed by default',
      await evaluate(
        `!document.querySelector('.pairing-panel')&&document.querySelector('[aria-expanded]').getAttribute('aria-expanded')==='false'`,
      ),
    );
    await evaluate(`document.querySelectorAll('.primary-nav button')[0].click()`);
    await delay(200);
    check(
      'research workspace still renders after switching modules',
      await evaluate(`document.querySelectorAll('.paper-table tbody tr').length===8`),
    );
    check(
      'credentials, font settings and pairing fixtures are byte-for-byte unchanged',
      (await fs.readFile(path.join(legacyDir, 'config.json'), 'utf8')) === config &&
        (await fs.readFile(path.join(legacyDir, 'pairing.json'), 'utf8')) === pairing,
    );
    await assertRejected(evaluate(`window.toolbox2.legacy('ai','rotate')`));
    check('renderer cannot request key rotations', true);
  } catch (e) {
    error = e;
    console.error(e.stack);
  } finally {
    await fs.mkdir(path.join(root, 'work'), { recursive: true });
    await fs.writeFile(
      path.join(root, 'work/migration-ui-check.json'),
      JSON.stringify({ ok: !error, checks, error: error?.message }, null, 2),
    );
    console.log(JSON.stringify({ ok: !error, checks }));
    bridge.close();
    for (const w of BrowserWindow.getAllWindows()) w.destroy();
    app.exit(error ? 1 : 0);
  }
})();
async function assertRejected(promise) {
  try {
    await promise;
  } catch {
    return;
  }
  throw Error('Unsafe operation accepted');
}
