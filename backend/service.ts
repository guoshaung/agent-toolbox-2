import http, { type IncomingMessage } from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { initialWorkspace } from './seed';
import type { Paper, Workspace, Annotation } from '../shared/types';

const MAX_BODY = 256 * 1024;
const blank: Annotation = { visits: 0, note: '', status: 'unread', pinned: false };
class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let size = 0; const chunks: Buffer[] = [];
  for await (const chunk of req) { size += chunk.length; if (size > MAX_BODY) throw new ApiError(413, '请求太大'); chunks.push(chunk); }
  try { const value = JSON.parse(Buffer.concat(chunks).toString() || '{}'); if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid object'); return value; } catch { throw new ApiError(400, '请求格式不正确'); }
}
function text(value: unknown, max = 300): string { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function abstractOf(index: Record<string, number[]> | undefined): string {
  if (!index) return '';
  const words: string[] = [];
  for (const [word, positions] of Object.entries(index)) for (const at of positions) if (at < 6000) words[at] = word;
  return words.join(' ').slice(0, 10000);
}
function normalize(work: any): Paper {
  const topics = [...new Set<string>([...(work.keywords || []).map((x: any) => x.display_name), ...(work.topics || []).slice(0, 3).map((x: any) => x.display_name)].filter(Boolean))];
  return {
    id: String(work.id), title: String(work.display_name || ''), date: work.publication_date || '', year: work.publication_year || 0,
    authors: (work.authorships || []).slice(0, 8).map((x: any) => x.author?.display_name).filter(Boolean),
    venue: work.primary_location?.source?.display_name || '未提供出版源',
    url: work.doi || work.primary_location?.landing_page_url || work.id,
    doi: String(work.doi || '').replace(/^https?:\/\/doi\.org\//i, ''),
    abstract: abstractOf(work.abstract_inverted_index), cited: Number(work.cited_by_count) || 0,
    topics: topics.slice(0, 8), references: work.referenced_works || [], openAccess: !!work.open_access?.is_oa, source: 'OpenAlex',
  };
}
export async function createService(dataDir: string, upstream: typeof fetch = fetch) {
  await fs.mkdir(dataDir, { recursive: true });
  const file = path.join(dataDir, 'workspace.json');
  let state: Workspace;
  try {
    state = JSON.parse(await fs.readFile(file, 'utf8'));
    if (state.version !== 1 || !Array.isArray(state.libraries) || !state.preferences || !state.annotations) throw Error('Unsupported workspace');
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      try { await fs.copyFile(file, path.join(dataDir, `workspace-recovery-${Date.now()}.json`)); }
      catch { throw Error('无法备份已有工作区，已停止启动，避免覆盖数据。'); }
    }
    state = initialWorkspace();
  }
  const token = crypto.randomBytes(32).toString('hex');
  let writes = Promise.resolve();
  async function persist() {
    const snapshot = JSON.stringify(state, null, 2);
    const next = writes.catch(() => {}).then(async () => { const tmp = `${file}.tmp`; await fs.writeFile(tmp, snapshot, { mode: 0o600 }); await fs.rename(tmp, file); });
    writes = next; await next;
  }
  await persist();
  const findLibrary = (id: unknown) => {
    const library = state.libraries.find(x => x.id === id);
    if (!library) throw new ApiError(404, '没有找到这个资料库'); return library;
  };
  const findPaper = (id: unknown) => {
    if (!state.libraries.some(l => l.papers.some(p => p.id === id))) throw new ApiError(404, '没有找到这篇论文');
    return String(id);
  };
  const activeSearches = new Set<string>();
  const server = http.createServer(async (req, res) => {
    const reply = (status: number, value: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)); };
    try {
      if (req.headers.origin || req.headers.host !== `127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`) throw new ApiError(403, '仅接受本机应用请求');
      const supplied = Buffer.from(String(req.headers.authorization || ''));
      const expected = Buffer.from(`Bearer ${token}`);
      if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) throw new ApiError(401, '应用连接验证失败');
      if (req.method === 'GET' && req.url === '/health') return reply(200, { ok: true });
      if (req.method === 'GET' && req.url === '/workspace') return reply(200, state);
      if (req.method !== 'POST') throw new ApiError(404, '接口不存在');
      const data = await body(req);
      if (req.url === '/search') {
        const library = findLibrary(data.libraryId), query = text(data.query, 400);
        if (query.length < 2) throw new ApiError(400, '请输入至少两个字符的研究主题');
        if (activeSearches.has(library.id)) throw new ApiError(409, '这个资料库正在检索，请稍等');
        activeSearches.add(library.id);
        try {
          const url = new URL('https://api.openalex.org/works');
          url.search = new URLSearchParams({ search: query, 'per-page': String(Math.max(10, Math.min(75, Number(data.limit) || 30))), filter: `to_publication_date:${new Date().toISOString().slice(0, 10)}`, sort: 'publication_date:desc,cited_by_count:desc' }).toString();
          const response = await upstream(url, { signal: AbortSignal.timeout(22000), headers: { Accept: 'application/json', 'User-Agent': 'AgentToolbox2/0.1 (research workspace)' } });
          if (!response.ok) throw new ApiError(502, `文献服务暂时不可用（${response.status}），已保留原有文献。`);
          const result = await response.json() as any;
          const papers = (result.results || []).map(normalize).filter((p: Paper) => p.title);
          const unique = [...new Map<string, Paper>(papers.map((p: Paper) => [p.id, p])).values()];
          const visibleIds = new Set(unique.map(p => p.id));
          for (const paper of unique) paper.references = paper.references.filter(id => visibleIds.has(id));
          Object.assign(library, { papers: unique, query, updatedAt: new Date().toISOString(), demo: false });
          await persist(); return reply(200, { workspace: state, count: unique.length, total: result.meta?.count || unique.length });
        } finally { activeSearches.delete(library.id); }
      }
      if (req.url === '/visit') {
        const id = findPaper(data.id), annotation = { ...blank, ...state.annotations[id] };
        annotation.visits++; state.annotations[id] = annotation; await persist(); return reply(200, annotation);
      }
      if (req.url === '/annotation') {
        const id = findPaper(data.id), annotation = { ...blank, ...state.annotations[id] };
        if ('note' in data) { if (typeof data.note !== 'string' || data.note.length > 30000) throw new ApiError(400, '笔记内容过长'); annotation.note = data.note; }
        if ('status' in data) { if (!['unread', 'reading', 'done'].includes(String(data.status))) throw new ApiError(400, '阅读状态无效'); annotation.status = data.status as Annotation['status']; }
        if ('pinned' in data) { if (typeof data.pinned !== 'boolean') throw new ApiError(400, '收藏状态无效'); annotation.pinned = data.pinned; }
        state.annotations[id] = annotation; await persist(); return reply(200, annotation);
      }
      if (req.url === '/preferences') {
        const next = { ...state.preferences };
        if (data.theme === 'dark' || data.theme === 'light') next.theme = data.theme;
        if (data.view === 'table' || data.view === 'graph') next.view = data.view;
        if (typeof data.detailOpen === 'boolean') next.detailOpen = data.detailOpen;
        if (typeof data.detailWidth === 'number') next.detailWidth = Math.max(280, Math.min(480, data.detailWidth));
        if (typeof data.activeLibrary === 'string') next.activeLibrary = findLibrary(data.activeLibrary).id;
        state.preferences = next; await persist(); return reply(200, next);
      }
      if (req.url === '/libraries') {
        const name = text(data.name, 60), query = text(data.query, 400);
        if (!name || query.length < 2) throw new ApiError(400, '请填写资料库名称和检索主题');
        if (state.libraries.length >= 50) throw new ApiError(400, '最多保存 50 个资料库');
        const library = { id: crypto.randomUUID(), name, query, color: '#66d9bd', papers: [], updatedAt: null, demo: false };
        state.libraries.push(library); state.preferences.activeLibrary = library.id; await persist(); return reply(200, state);
      }
      throw new ApiError(404, '接口不存在');
    } catch (error: any) {
      const message = error.name === 'TimeoutError' || error.name === 'AbortError' ? '联网检索超时，请稍后重试；原有文献已保留。' : error instanceof ApiError ? error.message : '操作未完成，请重试。';
      reply(error instanceof ApiError ? error.status : 500, { error: message });
    }
  });
  server.requestTimeout = 30000; server.headersTimeout = 10000;
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  return { port: (server.address() as import('node:net').AddressInfo).port, token, close: async () => { await writes.catch(() => {}); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); } };
}
const parentPort = (process as unknown as { parentPort?: { postMessage(message: unknown): void } }).parentPort;
if (parentPort) createService(process.argv[2]).then(({ port, token }) => parentPort.postMessage({ type: 'ready', port, token })).catch(() => { parentPort.postMessage({ type: 'error', message: '本地工作区无法启动，请检查数据目录权限。' }); process.exit(1); });
