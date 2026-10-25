const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises'),
  os = require('node:os'),
  path = require('node:path');
const { createService } = require('../dist-electron/service.cjs');
async function fixture(t, upstream) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'toolbox2-test-'));
  const service = await createService(dir, upstream);
  t.after(async () => {
    await service.close();
    await fs.rm(dir, { recursive: true, force: true });
  });
  const call = async (route, body, auth = true) => {
    const r = await fetch(`http://127.0.0.1:${service.port}${route}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Authorization: auth ? `Bearer ${service.token}` : 'Bearer invalid',
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, data: await r.json() };
  };
  return { call, dir, service };
}
test('local API requires authentication on all routes', async (t) => {
  const { call } = await fixture(t);
  assert.equal((await call('/workspace', undefined, false)).status, 401);
  assert.equal((await call('/health', undefined, false)).status, 401);
  assert.equal((await call('/health')).data.ok, true);
});
test('visits and annotations persist without losing each other', async (t) => {
  const { call, dir } = await fixture(t);
  const state = (await call('/workspace')).data,
    id = state.libraries[0].papers[0].id;
  await Promise.all(Array.from({ length: 6 }, () => call('/visit', { id })));
  await call('/annotation', { id, note: 'A real reading note', status: 'reading', pinned: true });
  const disk = JSON.parse(await fs.readFile(path.join(dir, 'workspace.json'), 'utf8'));
  assert.deepEqual(disk.annotations[id], {
    visits: 6,
    note: 'A real reading note',
    status: 'reading',
    pinned: true,
  });
  assert.equal((await call('/annotation', { id: 'missing', note: 'bad' })).status, 404);
  assert.equal((await call('/annotation', { id, status: 'bogus' })).status, 400);
});
test('failed searches retain the previous paper collection', async (t) => {
  const { call } = await fixture(t, async () => new Response('{}', { status: 503 }));
  const before = (await call('/workspace')).data.libraries[0];
  assert.equal((await call('/search', { libraryId: before.id, query: 'new query' })).status, 502);
  const after = (await call('/workspace')).data.libraries[0];
  assert.deepEqual(after, before);
});
test('successful search updates one library and keeps preferences and notes', async (t) => {
  let checked = false;
  const { call } = await fixture(t, async (url) => {
    const u = new URL(url);
    assert.match(u.searchParams.get('filter'), /^to_publication_date:/);
    checked = true;
    return Response.json({
      meta: { count: 1 },
      results: [
        {
          id: 'https://openalex.org/W1',
          display_name: 'A real upstream shape',
          publication_year: 2026,
          publication_date: '2026-01-01',
          authorships: [],
          cited_by_count: 4,
          primary_location: {},
          referenced_works: [],
          abstract_inverted_index: { Hello: [0], world: [1] },
        },
      ],
    });
  });
  await call('/preferences', { theme: 'light', view: 'graph', detailWidth: 999 });
  const result = await call('/search', { libraryId: 'rag', query: 'graph science', limit: 30 });
  assert.equal(result.status, 200);
  assert.equal(result.data.count, 1);
  assert.equal(result.data.workspace.preferences.view, 'graph');
  assert.equal(result.data.workspace.preferences.detailWidth, 480);
  assert.equal(result.data.workspace.libraries[0].papers[0].abstract, 'Hello world');
  assert.equal(result.data.workspace.libraries[1].papers.length, 0);
  assert.equal(checked, true);
});
test('library creation and malformed input are validated', async (t) => {
  const { call } = await fixture(t);
  assert.equal((await call('/libraries', { name: '', query: 'abc' })).status, 400);
  const r = await call('/libraries', { name: 'My new topic', query: 'graph science' });
  assert.equal(r.data.libraries.length, 4);
  assert.equal(r.data.preferences.activeLibrary, r.data.libraries[3].id);
  assert.equal((await call('/annotation', null)).status, 400);
});
test('unreadable saved state is backed up before recovery', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'toolbox2-recovery-'));
  await fs.writeFile(path.join(dir, 'workspace.json'), '{broken json');
  const service = await createService(dir);
  t.after(async () => {
    await service.close();
    await fs.rm(dir, { recursive: true, force: true });
  });
  const names = await fs.readdir(dir);
  assert.ok(names.some((n) => n.startsWith('workspace-recovery-')));
  assert.equal(JSON.parse(await fs.readFile(path.join(dir, 'workspace.json'), 'utf8')).version, 1);
});
