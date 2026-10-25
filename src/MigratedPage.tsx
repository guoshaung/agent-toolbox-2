import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronRight,
  Clipboard,
  ExternalLink,
  File,
  Folder,
  FolderPlus,
  LoaderCircle,
  Play,
  RefreshCw,
  Save,
  Search,
  Square,
  Upload,
  Wrench,
} from 'lucide-react';
import type { LegacyStatus } from '../shared/types';
import type { Module } from './LegacyPage';

type Props = {
  kind: Module;
  legacy: LegacyStatus | null;
  onConnect: () => Promise<void>;
  notify: (value: unknown) => void;
};
type ContainerItem = {
  name: string;
  relPath: string;
  isDir: boolean;
  size: number;
  modifiedAt: number;
};
type ContainerList = {
  ok: boolean;
  root: string;
  relPath: string;
  items: ContainerItem[];
  error?: string;
};
type Skill = { name: string; description: string; path: string; scope: string; updatedAt: number };
type Target = { id: string; label: string; path: string; exists: boolean };
type DshStatus = {
  status: string;
  url?: string;
  error?: string;
  warnings?: string[];
  botEnabled?: boolean;
  ok?: boolean;
};
type LiteratureFile = { name: string; size: number; modifiedAt: number };
const sections = [
  ['portal', '科研门户', '常用学术站点与浏览器'],
  ['academic', '学术入口', '数据库与论文搜索'],
  ['schools', '学校访问', '校园资源入口'],
  ['literature', '文献阅读', '论文阅读与批注'],
  ['fieldpapers', '领域论文', '前沿检索与关系图'],
  ['ideas', '研究想法', '想法记录与拆解'],
  ['figureboard', 'PPT 图板', '素材与图形设计'],
  ['drafter', '示意图', '论文图示绘制'],
  ['presentation', 'PPT 演示', '研究汇报制作'],
  ['library', '文献库', '分类、书目与引用'],
  ['innovation', '创新图谱', '研究方向梳理'],
  ['paper', '论文写作', '写作工作台'],
  ['papertalk', '论文讲解', '论文讲解与视频'],
  ['zotero', 'Zotero', '文献双向流转'],
  ['autoresearch', '自动科研', '科研代理工作流'],
] as const;
const fail = (result: any) => {
  if (result?.ok === false) throw Error(result.error || '操作失败');
  return result;
};
const fmtSize = (n: number) =>
  n < 1024
    ? `${n} B`
    : n < 1048576
      ? `${Math.round(n / 1024)} KB`
      : `${(n / 1048576).toFixed(1)} MB`;
function Heading({
  label,
  title,
  description,
}: {
  label: string;
  title: string;
  description: string;
}) {
  return (
    <div className="module-heading">
      <div>
        <div className="eyebrow">{label}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </div>
  );
}
function OpenOriginal({
  tool,
  notify,
}: {
  tool: 'dsh' | 'container' | 'skills';
  notify: Props['notify'];
}) {
  return (
    <button
      className="button"
      onClick={() =>
        void window.toolbox2.legacy('system', 'openTool', tool).then(fail).catch(notify)
      }
    >
      <ExternalLink size={14} />
      原版完整界面
    </button>
  );
}
function ResearchSuite({ notify }: Pick<Props, 'notify'>) {
  const [files, setFiles] = useState<LiteratureFile[]>([]);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState('');
  const refresh = async () =>
    setFiles(await window.toolbox2.legacy<LiteratureFile[]>('research', 'list'));
  useEffect(() => {
    void refresh().catch(notify);
  }, []);
  async function run(label: string, action: 'open' | 'openFile', payload: string) {
    setBusy(label);
    try {
      fail(await window.toolbox2.legacy('research', action, payload));
    } catch (error) {
      notify(error);
    } finally {
      setBusy('');
    }
  }
  const visible = files.filter((file) =>
    file.name.toLocaleLowerCase().includes(filter.toLocaleLowerCase()),
  );
  return (
    <div className="module-page migrated-page">
      <Heading
        label="RESEARCH TOOLKIT"
        title="科研工具"
        description="原有 15 个科研子页与文献目录已经接回。复杂编辑器会打开原工具箱窗口，继续使用原资料与服务。"
      />
      <div className="migrated-section-head">
        <h2>科研子页</h2>
        <span>15 个入口 · 原服务</span>
      </div>
      <div className="migrated-tool-grid">
        {sections.map(([id, title, detail]) => (
          <button
            className="migrated-tool"
            key={id}
            disabled={!!busy}
            onClick={() => void run(title, 'open', id)}
          >
            <BookOpen size={19} />
            <strong>{title}</strong>
            <small>{detail}</small>
            <ExternalLink size={14} className="tool-external" />
          </button>
        ))}
      </div>
      <div className="migrated-section-head">
        <h2>现有文献文件</h2>
        <button className="button" onClick={() => void refresh().catch(notify)}>
          <RefreshCw size={14} />
          刷新
        </button>
      </div>
      <div className="migrated-toolbar">
        <Search size={15} />
        <input
          aria-label="筛选文献"
          placeholder="按文件名筛选"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
        <span>{visible.length} 项</span>
      </div>
      <div className="migrated-file-list">
        {visible.length ? (
          visible.map((file) => (
            <button
              key={file.name}
              className="migrated-file-row"
              onClick={() => void run(file.name, 'openFile', file.name)}
            >
              <File size={17} />
              <span>{file.name}</span>
              <small>{fmtSize(file.size)}</small>
              <ExternalLink size={14} />
            </button>
          ))
        ) : (
          <p className="module-caption">文献目录中没有匹配的文件。可在「文献」或「文献库」导入。</p>
        )}
      </div>
    </div>
  );
}
function DshPage({ notify }: Pick<Props, 'notify'>) {
  const [state, setState] = useState<DshStatus | null>(null);
  const [bot, setBot] = useState(false);
  const [busy, setBusy] = useState(false);
  const view = useRef<HTMLElement & { reload?: () => void }>(null);
  const refresh = async () => {
    const [next, mode] = await Promise.all([
      window.toolbox2.legacy<DshStatus>('dsh', 'status'),
      window.toolbox2.legacy<{ enabled: boolean }>('dsh', 'bot'),
    ]);
    setState(next);
    setBot(mode.enabled);
  };
  useEffect(() => {
    void refresh().catch(notify);
    const timer = setInterval(() => void refresh().catch(() => {}), 6000);
    return () => clearInterval(timer);
  }, []);
  async function run(action: 'start' | 'stop' | 'setBot', payload?: boolean) {
    setBusy(true);
    try {
      const next = fail(await window.toolbox2.legacy<DshStatus>('dsh', action, payload));
      setState(next);
      if (action === 'setBot') setBot(!!next.botEnabled);
    } catch (error) {
      notify(error);
    } finally {
      setBusy(false);
    }
  }
  const running = state?.status === 'running';
  return (
    <div className="module-page migrated-page dsh-page">
      <Heading
        label="DEEPSEEK HARNESS"
        title="DSH 控制台"
        description="沿用原工具箱已安装的 DSH 内核、插件和 web profile。"
      />
      <div className="migrated-control">
        <span className={`state-pill ${running ? 'good' : ''}`}>{state?.status || '读取中'}</span>
        <button
          className={`button ${running ? '' : 'primary'}`}
          disabled={busy}
          onClick={() => void run(running ? 'stop' : 'start')}
        >
          {busy ? (
            <LoaderCircle size={15} className="spin" />
          ) : running ? (
            <Square size={15} />
          ) : (
            <Play size={15} />
          )}{' '}
          {running ? '停止 DSH' : '启动 DSH'}
        </button>
        <button className="button" disabled={busy} onClick={() => void run('setBot', !bot)}>
          DS Bot：{bot ? '开' : '关'}
        </button>
        <button className="button" disabled={!running} onClick={() => view.current?.reload?.()}>
          <RefreshCw size={14} />
          刷新
        </button>
        <OpenOriginal tool="dsh" notify={notify} />
      </div>
      {state?.error && (
        <p role="alert" className="module-error">
          {state.error}
        </p>
      )}
      {running && state?.url ? (
        <div className="migrated-dsh-view">
          {/** DSH uses a one-time launch URL. Keep this guest mounted until its URL changes. */}
          <webview
            ref={view}
            key={state.url}
            src={state.url}
            partition="persist:dsh-v2"
            allowpopups={false}
          />
        </div>
      ) : (
        <div className="drawing-empty">
          <Wrench size={30} />
          <h2>控制台尚未启动</h2>
          <p>点「启动 DSH」后在这里使用原插件和 Skill。</p>
        </div>
      )}
      {!!state?.warnings?.length && (
        <details className="module-history">
          <summary>启动提示 · {state.warnings.length}</summary>
          {state.warnings.map((warning, i) => (
            <p key={i}>{warning}</p>
          ))}
        </details>
      )}
    </div>
  );
}
function ContainerPage({ notify }: Pick<Props, 'notify'>) {
  const [location, setLocation] = useState<ContainerList | null>(null);
  const [path, setPath] = useState('');
  const [query, setQuery] = useState('');
  const [folder, setFolder] = useState('');
  const [preview, setPreview] = useState<ContainerItem | null>(null);
  const [content, setContent] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [runs, setRuns] = useState<Record<string, { running: boolean }>>({});
  const [runnable, setRunnable] = useState<Record<string, { kind: string }>>({});
  const [logs, setLogs] = useState('');
  const load = async (target = path) => {
    const next: ContainerList = fail(
      await window.toolbox2.legacy<ContainerList>('container', 'list', target),
    );
    setLocation(next);
    setPath(next.relPath);
    setPreview(null);
    setDirty(false);
    const candidates = next.items
      .filter((item) => item.isDir)
      .map((item) => item.relPath)
      .slice(0, 40);
    const results = await Promise.allSettled(
      candidates.map((item) =>
        window.toolbox2.legacy<{ ok: boolean; kind: string; command: string }>(
          'container',
          'probe',
          item,
        ),
      ),
    );
    const available: Record<string, { kind: string }> = {};
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.ok && result.value.command)
        available[candidates[index]] = { kind: result.value.kind };
    });
    setRunnable(available);
  };
  const loadRuns = async () => setRuns(await window.toolbox2.legacy('container', 'runStatus'));
  useEffect(() => {
    void load('').catch(notify);
    void loadRuns().catch(notify);
    const timer = setInterval(() => void loadRuns().catch(() => {}), 4000);
    return () => clearInterval(timer);
  }, []);
  async function act(
    action: 'mkdir' | 'pickImport' | 'organize' | 'write' | 'run' | 'stopRun',
    payload: unknown,
    feedback: string,
  ) {
    setBusy(true);
    try {
      const result: any = fail(await window.toolbox2.legacy('container', action, payload));
      if (!result?.cancelled) {
        notify(feedback);
        await load(path);
        await loadRuns();
      }
    } catch (error) {
      notify(error);
    } finally {
      setBusy(false);
    }
  }
  async function open(item: ContainerItem) {
    if (item.isDir) return load(item.relPath).catch(notify);
    setPreview(item);
    setLogs('');
    setDirty(false);
    try {
      const result = fail(
        await window.toolbox2.legacy<{ ok: boolean; content: string }>(
          'container',
          'read',
          item.relPath,
        ),
      );
      setContent(result.content);
    } catch (error) {
      setPreview(null);
      setContent('');
      notify(error);
    }
  }
  const visible = (location?.items || []).filter((item) =>
    item.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const crumbs = path.split('/').filter(Boolean);
  return (
    <div className="module-page migrated-page">
      <Heading
        label="LOCAL FILE SPACE"
        title="容器"
        description="浏览、导入、整理并启动原工具箱容器里的项目；文件留在原目录。"
      />
      <div className="migrated-control">
        <button
          className="button primary"
          disabled={busy}
          onClick={() => void act('pickImport', path, '文件已导入容器')}
        >
          <Upload size={15} />
          导入文件
        </button>
        <button
          className="button"
          disabled={busy}
          onClick={() => void act('organize', path, '已按文件类型整理')}
        >
          <Wrench size={15} />
          整理当前目录
        </button>
        <button className="button" onClick={() => void load(path).catch(notify)}>
          <RefreshCw size={15} />
          刷新
        </button>
        <OpenOriginal tool="container" notify={notify} />
      </div>
      <div className="migrated-toolbar">
        <button onClick={() => void load('').catch(notify)}>容器</button>
        {crumbs.map((part, index) => (
          <span key={index} className="migrated-crumb">
            <ChevronRight size={13} />
            <button onClick={() => void load(crumbs.slice(0, index + 1).join('/')).catch(notify)}>
              {part}
            </button>
          </span>
        ))}
        <span>{visible.length} 项</span>
      </div>
      <div className="migrated-toolbar">
        <Search size={15} />
        <input
          aria-label="筛选容器"
          placeholder="筛选当前目录"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <input
          aria-label="新文件夹名称"
          placeholder="新文件夹名称"
          value={folder}
          onChange={(event) => setFolder(event.target.value)}
        />
        <button
          className="button"
          disabled={!folder.trim() || busy}
          onClick={() =>
            void act('mkdir', { relPath: path, name: folder }, '文件夹已创建').then(() =>
              setFolder(''),
            )
          }
        >
          <FolderPlus size={14} />
          新建
        </button>
      </div>
      <div className="migrated-file-list">
        {visible.map((item) => {
          const abs = `${location?.root}\\${item.relPath.replaceAll('/', '\\')}`;
          const active = !!runs[abs]?.running;
          return (
            <div className="migrated-file-row" key={item.relPath}>
              <button className="migrated-file-open" onClick={() => void open(item)}>
                {item.isDir ? <Folder size={17} /> : <File size={17} />}
                <span>{item.name}</span>
              </button>
              <small>
                {item.isDir ? runnable[item.relPath]?.kind || '文件夹' : fmtSize(item.size)}
              </small>
              {item.isDir && runnable[item.relPath] && (
                <>
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() =>
                      void act(active ? 'stopRun' : 'run', item.relPath, '工具状态已更新')
                    }
                  >
                    {active ? <Square size={13} /> : <Play size={13} />} {active ? '停止' : '启动'}
                  </button>
                  <button
                    className="button"
                    onClick={() =>
                      void window.toolbox2
                        .legacy<string>('container', 'runLog', item.relPath)
                        .then(setLogs)
                        .catch(notify)
                    }
                  >
                    日志
                  </button>
                </>
              )}
            </div>
          );
        })}
        {!visible.length && (
          <p className="module-caption">当前目录没有匹配项目。可导入文件或新建文件夹。</p>
        )}
      </div>
      {preview && (
        <section className="migrated-editor">
          <div className="migrated-section-head">
            <h2>{preview.name}</h2>
            <button
              className="button primary"
              disabled={!dirty || busy}
              onClick={() => void act('write', { relPath: preview.relPath, content }, '已保存文件')}
            >
              <Save size={14} />
              保存
            </button>
          </div>
          <textarea
            spellCheck={false}
            value={content}
            onChange={(event) => {
              setContent(event.target.value);
              setDirty(true);
            }}
          />
        </section>
      )}
      {logs && <pre className="migrated-log">{logs}</pre>}
    </div>
  );
}
function SkillsPage({ notify }: Pick<Props, 'notify'>) {
  const [targets, setTargets] = useState<Target[]>([]),
    [skills, setSkills] = useState<Skill[]>([]);
  const [targetId, setTargetId] = useState('personal-dsh'),
    [name, setName] = useState(''),
    [description, setDescription] = useState(''),
    [source, setSource] = useState('');
  const [selected, setSelected] = useState<Skill | null>(null),
    [content, setContent] = useState(''),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState('');
  const refresh = async () => {
    const [t, s] = await Promise.all([
      window.toolbox2.legacy<Target[]>('skill', 'targets'),
      window.toolbox2.legacy<Skill[]>('skill', 'list'),
    ]);
    setTargets(t);
    setSkills(s);
    if (!t.some((x) => x.id === targetId)) setTargetId(t[0]?.id || '');
  };
  useEffect(() => {
    void refresh().catch(notify);
  }, []);
  async function read(skill: Skill) {
    try {
      const result = fail(
        await window.toolbox2.legacy<{ ok: boolean; content: string }>('skill', 'read', skill.path),
      );
      setSelected(skill);
      setContent(result.content);
    } catch (error) {
      notify(error);
    }
  }
  async function save() {
    if (!source.trim()) return notify('先粘贴 Skill 内容或操作说明');
    setBusy(true);
    try {
      const cleaned = source
        .trim()
        .replace(/^```(?:md|markdown)?\s*\n/i, '')
        .replace(/\n```$/, '')
        .trim();
      const frontmatter = /^---\r?\n[\s\S]*?\r?\n---/.test(cleaned);
      const metaName = cleaned
        .match(/^name:\s*(.+)$/m)?.[1]
        ?.replace(/^['"]|['"]$/g, '')
        .trim();
      const metaDescription = cleaned
        .match(/^description:\s*(.+)$/m)?.[1]
        ?.replace(/^['"]|['"]$/g, '')
        .trim();
      const fallback = `skill-${[...cleaned].reduce((hash, ch) => Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0, 2166136261).toString(16)}`;
      const slug = (name || metaName || '')
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 64)
        .replace(/-$/, '');
      const derivedName = slug || fallback;
      const body = cleaned.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim();
      const derivedDescription =
        description || metaDescription || body.replace(/\s+/g, ' ').slice(0, 150);
      const raw =
        frontmatter &&
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(metaName || '') &&
        !!metaDescription &&
        !name &&
        !description;
      const result: any = await window.toolbox2.legacy('skill', 'write', {
        targetId,
        name: derivedName,
        description: derivedDescription,
        content: cleaned,
        raw,
      });
      if (result?.code === 'exists') return notify('同名 Skill 已存在，请换个名称；已有文件未覆盖');
      fail(result);
      notify(`已添加 ${derivedName}/SKILL.md`);
      setSource('');
      setName('');
      setDescription('');
      await refresh();
    } catch (error) {
      notify(error);
    } finally {
      setBusy(false);
    }
  }
  const visible = skills.filter((item) =>
    `${item.name} ${item.description} ${item.scope}`
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase()),
  );
  return (
    <div className="module-page migrated-page">
      <Heading
        label="AGENT SKILLS"
        title="Skill 管理"
        description="沿用原目录与已安装 Skill。可以直接粘贴操作说明，自动补齐 SKILL.md 的格式。"
      />
      <div className="migrated-control">
        <OpenOriginal tool="skills" notify={notify} />
        <span className="module-caption">
          蒸馏 Skill、收藏与 MCP 高级设置在原版完整界面中继续可用。
        </span>
      </div>
      <div className="migrated-skill-layout">
        <section className="migrated-editor">
          <h2>快速添加</h2>
          <label>
            安装位置
            <select value={targetId} onChange={(event) => setTargetId(event.target.value)}>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            名称（可留空）
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如 paper-review"
            />
          </label>
          <label>
            描述（可留空）
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="什么时候使用这个 Skill"
            />
          </label>
          <label>
            粘贴完整 SKILL.md 或一段操作说明
            <textarea
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder="粘贴即可；普通文字会自动补充标准头部"
            />
          </label>
          <button
            className="button primary"
            disabled={busy || !source.trim()}
            onClick={() => void save()}
          >
            <Save size={14} />
            保存 Skill
          </button>
        </section>
        <section className="migrated-editor">
          <div className="migrated-section-head">
            <h2>已有 Skill · {visible.length}</h2>
            <button className="button" onClick={() => void refresh().catch(notify)}>
              <RefreshCw size={14} />
              刷新
            </button>
          </div>
          <div className="migrated-toolbar">
            <Search size={15} />
            <input
              aria-label="搜索 Skill"
              value={query}
              placeholder="搜索名称或目录"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="migrated-skill-list">
            {visible.map((skill) => (
              <button
                className={selected?.path === skill.path ? 'selected' : ''}
                key={skill.path}
                onClick={() => void read(skill)}
              >
                <strong>{skill.name}</strong>
                <span>{skill.description}</span>
                <small>{skill.scope}</small>
              </button>
            ))}
          </div>
        </section>
      </div>
      {selected && (
        <section className="migrated-editor">
          <div className="migrated-section-head">
            <h2>{selected.name} / SKILL.md</h2>
            <button
              className="button"
              onClick={() =>
                void window.toolbox2
                  .legacy('system', 'copyText', content)
                  .then(() => notify('已复制'))
                  .catch(notify)
              }
            >
              <Clipboard size={14} />
              复制
            </button>
          </div>
          <pre className="migrated-skill-preview">{content}</pre>
        </section>
      )}
    </div>
  );
}
export function MigratedPage({ kind, legacy, onConnect, notify }: Props) {
  if (!legacy?.connected)
    return (
      <section className="module-offline">
        <div className="module-large-icon">
          <Wrench size={30} />
        </div>
        <h1>连接现有工具箱</h1>
        <p>科研、DSH、容器和 Skill 共用原有资料与服务。</p>
        <button className="button primary" onClick={() => void onConnect()}>
          连接现有工具箱
        </button>
      </section>
    );
  if (kind === 'research-suite') return <ResearchSuite notify={notify} />;
  if (kind === 'dsh') return <DshPage notify={notify} />;
  if (kind === 'container') return <ContainerPage notify={notify} />;
  if (kind === 'skills') return <SkillsPage notify={notify} />;
  return null;
}
