'use strict';
// Transitional controller hosted by the existing Toolbox process. Credentials,
// gateway and notebook have exactly one owner; V2 never decrypts or copies them.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const AI = new Set(['status', 'start', 'stop', 'refresh', 'test', 'copyKey']);
const DRAWING = new Set(['status', 'start', 'stop', 'qr']);
const RESEARCH_SECTIONS = new Set([
  'portal',
  'academic',
  'schools',
  'literature',
  'fieldpapers',
  'ideas',
  'figureboard',
  'drafter',
  'presentation',
  'library',
  'innovation',
  'paper',
  'papertalk',
  'zotero',
  'autoresearch',
]);

function within(root, candidate) {
  const base = fs.realpathSync(root);
  const target = fs.realpathSync(candidate);
  return target === base || target.startsWith(base + path.sep);
}
function skillTarget(file) {
  const skills = require('./skill-factory');
  const roots = skills.skillRoots({ homeDir: require('node:os').homedir(), projectDir: '' });
  if (typeof file !== 'string' || path.basename(file) !== 'SKILL.md') throw Error('Skill 路径无效');
  if (!roots.some((root) => fs.existsSync(root.path) && within(root.path, file)))
    throw Error('Skill 不在可用目录内');
  return file;
}
function skillDirectory(id) {
  const skills = require('./skill-factory');
  const target = skills
    .skillRoots({ homeDir: require('node:os').homedir(), projectDir: '' })
    .find((root) => root.id === id);
  if (!target) throw Error('Skill 目标目录无效');
  return target.path;
}
async function invokeContainer(directory, action, payload) {
  const container = require('./container-storage');
  const shelf = require('./app-shelf');
  const userData = () => directory;
  const rel = typeof payload === 'string' ? payload : String(payload?.relPath || '');
  if (action === 'list') return container.listContainer(userData, rel);
  if (action === 'mkdir') return container.makeFolder(userData, rel, payload?.name);
  if (action === 'read') return container.readContainerFile(userData, rel);
  if (action === 'write') return container.writeContainerFile(userData, rel, payload?.content);
  if (action === 'organize') return container.organize(userData, rel);
  if (action === 'applyPlan') return container.moveFiles(userData, rel, payload?.groups);
  if (action === 'import') {
    if (!Array.isArray(payload?.sources) || payload.sources.length > 100)
      throw Error('导入文件数量无效');
    return container.importIntoContainer(userData, payload.sources, rel);
  }
  if (['probe', 'run', 'stopRun', 'runStatus', 'runLog'].includes(action)) {
    if (action === 'runStatus') {
      const root = container.containerRoot(userData);
      return Object.fromEntries(
        Object.entries(shelf.status()).filter(([item]) => {
          try {
            return within(root, item);
          } catch {
            return false;
          }
        }),
      );
    }
    if (!rel) throw Error('请选择容器中的项目文件夹');
    const location = await container.listContainer(userData, rel);
    if (!location.ok || location.relPath !== rel.replace(/\\/g, '/').replace(/\/$/, ''))
      throw Error('工具目录无效');
    const target = path.join(location.root, location.relPath);
    if (action === 'probe') return shelf.probe(target);
    if (action === 'runLog') return shelf.tail(target).slice(-50000);
    if (action === 'stopRun') return shelf.stop(target);
    const info = shelf.probe(target);
    if (!info.ok || !info.command) throw Error('未识别到启动命令');
    return shelf.start({ id: target, cwd: target, command: info.command });
  }
  throw Error('不支持的容器操作');
}
function invokeSkill(action, payload) {
  const skills = require('./skill-factory');
  if (action === 'targets')
    return skills.skillRoots({ homeDir: require('node:os').homedir(), projectDir: '' });
  if (action === 'list')
    return skills.listSkills({ homeDir: require('node:os').homedir(), projectDir: '' });
  if (action === 'read') return { ok: true, content: skills.readSkill(skillTarget(payload)) };
  if (action === 'write') {
    if (!payload || typeof payload !== 'object' || typeof payload.content !== 'string')
      throw Error('Skill 内容无效');
    if (
      Object.keys(payload).some(
        (key) => !['targetId', 'name', 'description', 'content', 'overwrite', 'raw'].includes(key),
      )
    )
      throw Error('Skill 参数无效');
    const target = skillDirectory(payload.targetId);
    const name = skills.sanitizeSkillName(payload.name);
    const proposed = path.join(target, name, 'SKILL.md');
    if (fs.existsSync(path.dirname(proposed)) && !within(target, path.dirname(proposed)))
      throw Error('Skill 目标目录无效');
    if (fs.existsSync(proposed)) skillTarget(proposed);
    return skills.writeSkill({
      directory: target,
      name,
      description: payload.description,
      content: payload.content,
      overwrite: payload.overwrite === true,
      raw: payload.raw === true,
    });
  }
  throw Error('不支持的 Skill 操作');
}
function literatureDirectory(directory) {
  const target = path.join(directory, 'literature');
  fs.mkdirSync(target, { recursive: true });
  return target;
}
function literatureFile(directory, name) {
  if (typeof name !== 'string' || !name || name !== path.basename(name))
    throw Error('文献名称无效');
  const file = path.join(literatureDirectory(directory), name);
  if (!fs.statSync(file).isFile()) throw Error('文献文件不存在');
  return file;
}
async function invokeResearch(directory, action, payload, openResearch) {
  if (action === 'open' && RESEARCH_SECTIONS.has(payload)) return openResearch(payload);
  if (action === 'list')
    return fs
      .readdirSync(literatureDirectory(directory), { withFileTypes: true })
      .filter((item) => item.isFile() && !item.name.startsWith('.'))
      .map((item) => {
        const stat = fs.statSync(path.join(literatureDirectory(directory), item.name));
        return { name: item.name, size: stat.size, modifiedAt: stat.mtimeMs };
      })
      .sort((a, b) => b.modifiedAt - a.modifiedAt)
      .slice(0, 1000);
  if (action === 'openFile') {
    const result = await require('electron').shell.openPath(literatureFile(directory, payload));
    return { ok: !result, error: result || '' };
  }
  throw Error('不支持的科研操作');
}

async function startBridge({
  directory,
  ai,
  drawing,
  dsh,
  openResearch,
  openOther,
  preferences,
  version,
  clipboard,
}) {
  const token = crypto.randomBytes(32).toString('hex');
  const descriptor = path.join(directory, 'v2-bridge.json');
  const server = http.createServer(async (req, res) => {
    const reply = (code, value) => {
      res.writeHead(code, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(JSON.stringify(value));
    };
    try {
      if (req.headers.origin || req.headers.host !== `127.0.0.1:${server.address().port}`)
        return reply(403, { error: '仅限本机工具箱' });
      const supplied = Buffer.from(String(req.headers.authorization || ''));
      const expected = Buffer.from(`Bearer ${token}`);
      if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected))
        return reply(401, { error: '连接验证失败' });
      if (req.method !== 'POST' || req.url !== '/invoke')
        return reply(404, { error: '接口不存在' });
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 600000) throw Error('请求过大');
        chunks.push(chunk);
      }
      const input = JSON.parse(Buffer.concat(chunks).toString());
      const { scope, action, payload } = input || {};
      let result;
      if (scope === 'system' && action === 'status')
        result = { protocol: 1, version, preferences: preferences() };
      else if (
        scope === 'system' &&
        action === 'openTool' &&
        ['container', 'skills', 'dsh'].includes(payload)
      )
        result = openOther(payload);
      else if (scope === 'ai' && AI.has(action)) {
        if (
          ['refresh', 'test'].includes(action) &&
          (typeof payload !== 'string' || payload.length > 100)
        )
          throw Error('无效通道');
        result = await ai(`aiHub:${action}`, payload);
      } else if (scope === 'ai' && action === 'update') {
        // Only existing channel routing fields may change. Never accept apiKey,
        // auth blobs, base URLs or resets from the V2 renderer.
        const current = (await ai('aiHub:status')).channels.find((c) => c.id === payload?.id);
        if (!current) throw Error('通道不存在');
        if (
          typeof payload.model !== 'string' ||
          payload.model.length > 150 ||
          !Number.isInteger(payload.priority) ||
          payload.priority < 0 ||
          payload.priority > 999 ||
          typeof payload.enabled !== 'boolean'
        )
          throw Error('模型或优先级无效');
        if (current.models?.length && !current.models.includes(payload.model))
          throw Error('请选择已有模型目录中的模型');
        result = await ai('aiHub:save', {
          ...current,
          model: payload.model,
          priority: payload.priority,
          enabled: payload.enabled,
        });
      } else if (scope === 'drawing' && DRAWING.has(action))
        result = await drawing(`drawing:${action}`, payload);
      else if (scope === 'dsh') {
        if (action === 'status') result = dsh.status();
        else if (action === 'start') result = await dsh.start();
        else if (action === 'stop') result = await dsh.stop();
        else if (action === 'bot') result = { enabled: dsh.botEnabled() };
        else if (action === 'setBot' && typeof payload === 'boolean')
          result = await dsh.setBot(payload);
        else throw Error('不支持的 DSH 操作');
      } else if (scope === 'container') result = await invokeContainer(directory, action, payload);
      else if (scope === 'skill') result = invokeSkill(action, payload);
      else if (scope === 'research')
        result = await invokeResearch(directory, action, payload, openResearch);
      else if (scope === 'system' && action === 'copyText') {
        if (typeof payload !== 'string' || payload.length > 12000) throw Error('复制内容过长');
        clipboard.writeText(payload);
        result = { copied: true };
      } else return reply(404, { error: '不支持的桥接操作' });
      if (result?.ok === false) throw Error(result.error || '旧版服务操作失败');
      reply(200, result ?? {});
    } catch (error) {
      reply(400, { error: error.message || '桥接操作失败' });
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    fs.writeFileSync(
      descriptor + '.tmp',
      JSON.stringify({ protocol: 1, port: server.address().port, token, pid: process.pid }),
      { mode: 0o600 },
    );
    fs.renameSync(descriptor + '.tmp', descriptor);
  } catch (error) {
    server.close();
    throw error;
  }
  return {
    server,
    close() {
      server.close();
      server.closeAllConnections?.();
      try {
        if (JSON.parse(fs.readFileSync(descriptor, 'utf8')).token === token)
          fs.unlinkSync(descriptor);
      } catch {}
    },
  };
}
module.exports = { startBridge };
