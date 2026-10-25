'use strict';
// Transitional controller hosted by the existing Toolbox process. Credentials,
// gateway and notebook have exactly one owner; V2 never decrypts or copies them.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const AI = new Set(['status', 'start', 'stop', 'refresh', 'test', 'copyKey']);
const DRAWING = new Set(['status', 'start', 'stop', 'qr']);

async function startBridge({ directory, ai, drawing, preferences, version, clipboard }) {
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
        if (size > 16384) throw Error('请求过大');
        chunks.push(chunk);
      }
      const input = JSON.parse(Buffer.concat(chunks).toString());
      const { scope, action, payload } = input || {};
      let result;
      if (scope === 'system' && action === 'status')
        result = { protocol: 1, version, preferences: preferences() };
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
