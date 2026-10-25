const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { startBridge } = require('../compat/legacy-bridge.cjs');

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'toolbox2-bridge-'));
  const channels = [
    {
      id: 'existing',
      name: 'Existing',
      model: 'minimax-m3.1-flash',
      models: ['minimax-m3.1-flash', 'other'],
      priority: 10,
      enabled: true,
      keyEncrypted: undefined,
    },
  ];
  let saved,
    rotated = false;
  const bridge = await startBridge({
    directory,
    version: 'test',
    preferences: () => ({ typography: 'q-headings', scale: 'xlarge' }),
    clipboard: { writeText() {} },
    ai: async (action, payload) => {
      if (action === 'aiHub:status') return { channels };
      if (action === 'aiHub:save') {
        saved = payload;
        return { channels };
      }
      if (action === 'aiHub:rotate') rotated = true;
      return {};
    },
    drawing: async () => ({ enabled: true, sequence: 33, identity: { code: '1234' } }),
  });
  t.after(async () => {
    bridge.close();
    await fs.rm(directory, { recursive: true, force: true });
  });
  const descriptor = JSON.parse(await fs.readFile(path.join(directory, 'v2-bridge.json')));
  const request = (body, options = {}) =>
    fetch(`http://127.0.0.1:${descriptor.port}/invoke`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${descriptor.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(body),
    });
  return { directory, bridge, descriptor, request, saved: () => saved, rotated: () => rotated };
}
test('bridge requires authentication and rejects browser origins', async (t) => {
  const f = await fixture(t);
  assert.equal(
    (await f.request({ scope: 'ai', action: 'status' }, { headers: { Authorization: '' } })).status,
    401,
  );
  assert.equal(
    (
      await f.request(
        { scope: 'ai', action: 'status' },
        { headers: { Origin: 'https://example.com' } },
      )
    ).status,
    403,
  );
  const status = await new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: f.descriptor.port,
        path: '/invoke',
        method: 'POST',
        headers: { Host: 'evil.example', Authorization: `Bearer ${f.descriptor.token}` },
      },
      (res) => {
        res.resume();
        resolve(res.statusCode);
      },
    );
    req.on('error', reject);
    req.end('{}');
  });
  assert.equal(status, 403);
});
test('bridge never exposes credential rotations or arbitrary config operations', async (t) => {
  const f = await fixture(t);
  for (const body of [
    { scope: 'ai', action: 'rotate' },
    { scope: 'drawing', action: 'rotate' },
    { scope: 'system', action: 'config' },
  ])
    assert.equal((await f.request(body)).status, 404);
  assert.equal(f.rotated(), false);
});
test('routing update preserves source configuration and ignores injected keys', async (t) => {
  const f = await fixture(t);
  const response = await f.request({
    scope: 'ai',
    action: 'update',
    payload: {
      id: 'existing',
      model: 'other',
      priority: 30,
      enabled: false,
      apiKey: 'do-not-save',
      clearKey: true,
      source: 'api',
    },
  });
  assert.equal(response.status, 200);
  assert.equal(f.saved().model, 'other');
  assert.equal(f.saved().name, 'Existing');
  assert.equal(f.saved().apiKey, undefined);
  assert.equal(f.saved().clearKey, undefined);
  assert.equal(f.saved().source, undefined);
  assert.equal(
    (
      await f.request({
        scope: 'ai',
        action: 'update',
        payload: { id: 'existing', model: 'unknown', priority: 30, enabled: true },
      })
    ).status,
    400,
  );
});
test('bridge reads original identity and preferences; close removes descriptor', async (t) => {
  const f = await fixture(t);
  assert.equal(
    (await (await f.request({ scope: 'system', action: 'status' })).json()).preferences.scale,
    'xlarge',
  );
  assert.equal(
    (await (await f.request({ scope: 'drawing', action: 'status' })).json()).identity.code,
    '1234',
  );
  f.bridge.close();
  await assert.rejects(fs.access(path.join(f.directory, 'v2-bridge.json')));
});
