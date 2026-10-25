import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownWideNarrow, ArrowRight, BookOpen, Bookmark, Check, ChevronDown, ChevronRight, CircleHelp, Command, Download, Folder, FolderPlus, GitBranch, Layers, Library as LibraryIcon, LoaderCircle, Minus, Moon, Network, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, PenTool, Plus, Search, Sparkles, Square, Sun, Table2, X, Zap } from 'lucide-react';
import type { Annotation, Library, Paper, Preferences, SearchResult, Workspace } from '../shared/types';
import { Detail } from './Detail';
import { Graph } from './Graph';
import { emptyAnnotation, heat, linksFor, readingList, statusLabels } from './model';

export function App() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null), [fatal, setFatal] = useState('');
  const [selectedId, setSelectedId] = useState(''), [query, setQuery] = useState(''), [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('frontier'), [textFilter, setTextFilter] = useState('');
  const [searching, setSearching] = useState(false), [sidebarOpen, setSidebarOpen] = useState(true), [toast, setToast] = useState('');
  const [modal, setModal] = useState<'new' | 'help' | null>(null), [libraryName, setLibraryName] = useState(''), [libraryQuery, setLibraryQuery] = useState('');
  const [creating, setCreating] = useState(false), [detailWidth, setDetailWidth] = useState(340);
  const searchRef = useRef<HTMLInputElement>(null), filterRef = useRef<HTMLInputElement>(null);
  const resize = useRef<{ x: number; width: number } | null>(null), widthRef = useRef(detailWidth);
  const library = workspace?.libraries.find(l => l.id === workspace.preferences.activeLibrary) || workspace?.libraries[0];
  const preferences = workspace?.preferences;
  const annotation = (id: string) => workspace?.annotations[id] || emptyAnnotation;
  const notify = (error: unknown) => setToast(error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : String(error));
  useEffect(() => { if (!window.toolbox2) { setFatal('请通过 Toolbox 2 桌面预览程序打开这个工作区。'); return; } window.toolbox2.request<Workspace>('/workspace').then(setWorkspace).catch(e => setFatal(String(e.message))); }, []);
  useEffect(() => { if (library) { setQuery(library.query); setSelectedId(library.papers[0]?.id || ''); setTextFilter(''); setFilter('all'); } }, [library?.id]);
  useEffect(() => { if (preferences) { document.documentElement.dataset.theme = preferences.theme; setDetailWidth(preferences.detailWidth); widthRef.current = preferences.detailWidth; } }, [preferences?.theme, preferences?.detailWidth]);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 4500); return () => clearTimeout(id); }, [toast]);
  useEffect(() => {
    const keyboard = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus(); searchRef.current?.select(); }
      if (e.key === 'Escape') setModal(null);
    }; window.addEventListener('keydown', keyboard); return () => window.removeEventListener('keydown', keyboard);
  }, []);
  async function savePreferences(patch: Partial<Preferences>) {
    const next = await window.toolbox2.request<Preferences>('/preferences', patch);
    setWorkspace(w => w ? { ...w, preferences: next } : w);
  }
  async function updateAnnotation(id: string, patch: Partial<Annotation>) {
    const next = await window.toolbox2.request<Annotation>('/annotation', { id, ...patch });
    setWorkspace(w => w ? { ...w, annotations: { ...w.annotations, [id]: { ...next, visits: Math.max(w.annotations[id]?.visits || 0, next.visits) } } } : w);
  }
  function selectPaper(paper: Paper) {
    setSelectedId(paper.id);
    window.toolbox2.request<Annotation>('/visit', { id: paper.id }).then(next => setWorkspace(w => w ? { ...w, annotations: { ...w.annotations, [paper.id]: { ...next, visits: Math.max(w.annotations[paper.id]?.visits || 0, next.visits) } } } : w)).catch(notify);
  }
  async function search() {
    if (!library || searching) return;
    if (query.trim().length < 2) { searchRef.current?.focus(); notify('先输入一个研究领域或交叉主题'); return; }
    setSearching(true);
    try {
      const result = await window.toolbox2.request<SearchResult>('/search', { libraryId: library.id, query: query.trim(), limit: 30 });
      setWorkspace(result.workspace); setSelectedId(result.workspace.libraries.find(l => l.id === library.id)?.papers[0]?.id || '');
      setFilter('all'); setTextFilter(''); notify(`已获取 ${result.count} 篇论文，按最新发表时间排列`);
    } catch (error) { notify(error); } finally { setSearching(false); }
  }
  async function createLibrary(e: React.FormEvent) {
    e.preventDefault(); if (creating) return; setCreating(true);
    try { const next = await window.toolbox2.request<Workspace>('/libraries', { name: libraryName, query: libraryQuery }); setWorkspace(next); setModal(null); setLibraryName(''); setLibraryQuery(''); }
    catch (error) { notify(error); } finally { setCreating(false); }
  }
  const papers = useMemo(() => {
    const list = (library?.papers || []).filter(p => (filter === 'all' || (filter === 'pinned' ? workspace?.annotations[p.id]?.pinned : (workspace?.annotations[p.id]?.status || 'unread') === filter)) && `${p.title} ${p.authors.join(' ')} ${p.topics.join(' ')}`.toLowerCase().includes(textFilter.toLowerCase()));
    return [...list].sort((a, b) => sort === 'cited' ? b.cited - a.cited : sort === 'visits' ? (workspace?.annotations[b.id]?.visits || 0) - (workspace?.annotations[a.id]?.visits || 0) : b.date.localeCompare(a.date) || b.cited - a.cited);
  }, [library?.papers, workspace?.annotations, filter, sort, textFilter]);
  const selected = library?.papers.find(p => p.id === selectedId) || library?.papers[0];
  const relationships = useMemo(() => linksFor(library?.papers || []), [library?.papers]);
  const related = selected ? (library?.papers || []).filter(p => p.id !== selected.id && relationships.some(e => (e.source === selected.id && e.target === p.id) || (e.target === selected.id && e.source === p.id))) : [];
  const reading = (library?.papers || []).filter(p => annotation(p.id).status === 'reading').length;
  const completed = (library?.papers || []).filter(p => annotation(p.id).status === 'done').length;
  const visits = (library?.papers || []).reduce((n, p) => n + annotation(p.id).visits, 0);
  const showDetail = !!preferences?.detailOpen && !!selected;
  useEffect(() => {
    const move = (e: PointerEvent) => { if (!resize.current) return; const next = Math.max(280, Math.min(480, resize.current.width + resize.current.x - e.clientX)); widthRef.current = next; setDetailWidth(next); };
    const end = () => { if (!resize.current) return; resize.current = null; document.body.classList.remove('resizing'); void savePreferences({ detailWidth: widthRef.current }).catch(notify); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end); return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); };
  }, []);
  if (fatal) return <div className="boot-screen"><div className="brand-mark"><Layers/></div><h1>工作区暂时无法打开</h1><p>{fatal}</p><button className="button primary" onClick={() => location.reload()}>重试连接</button></div>;
  if (!workspace || !library || !preferences) return <div className="boot-screen"><LoaderCircle className="spin" size={25}/><p>正在打开你的工作区…</p></div>;
  return <div className="app-shell">
    <header className="titlebar"><div className="titlebar-drag"><span className="titlebar-mark"><Layers size={13}/></span>Agent Toolbox <b>2</b><span className="preview-badge">PREVIEW</span></div><div className="titlebar-actions"><button title="最小化" onClick={() => window.toolbox2.window('minimize')}><Minus size={15}/></button><button title="最大化 / 还原" onClick={() => window.toolbox2.window('maximize')}><Square size={12}/></button><button className="window-close" title="关闭" onClick={() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); setTimeout(() => window.toolbox2.window('close'), 500); }}><X size={17}/></button></div></header>
    <div className={`app-body ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
      {sidebarOpen && <aside className="sidebar">
        <div className="workspace-brand"><div className="brand-mark"><Layers size={23}/></div><div><strong>Toolbox Studio</strong><span>你的个人研究工作区</span></div><button className="icon-button" title="收起侧栏" onClick={() => setSidebarOpen(false)}><PanelLeftClose size={17}/></button></div>
        <button className="quick-search" onClick={() => { searchRef.current?.focus(); searchRef.current?.select(); }}><Search size={15}/><span>快速检索</span><kbd>Ctrl K</kbd></button>
        <div className="nav-section-label">工作空间</div>
        <nav className="primary-nav"><button className="active"><BookOpen size={18}/><span>科研工作台</span><span className="nav-dot"/></button><button disabled title="后续版本接入"><Zap size={18}/><span>额度中枢</span><small>规划中</small></button><button disabled title="后续版本接入"><PenTool size={18}/><span>绘图同步</span><small>规划中</small></button></nav>
        <div className="nav-section-label library-label"><span>我的资料库</span><button className="icon-button" title="新建资料库" onClick={() => setModal('new')}><Plus size={15}/></button></div>
        <div className="library-nav">{workspace.libraries.map(l => <button disabled={searching} key={l.id} className={l.id === library.id ? 'selected' : ''} onClick={() => void savePreferences({ activeLibrary: l.id }).catch(notify)}><Folder size={16} color={l.color}/><span>{l.name}</span><small>{l.papers.length}</small></button>)}<button className="new-library" onClick={() => setModal('new')}><FolderPlus size={15}/><span>新建资料库</span></button></div>
        <div className="sidebar-bottom"><div className="local-first"><span className="live-dot"/><div><strong>本地工作区</strong><span>文献、笔记自动保存在本机</span></div></div><button className="profile-button" onClick={() => setModal('help')}><span className="avatar">G</span><div><strong>我的研究空间</strong><span>Toolbox 2 · v0.1.0</span></div><CircleHelp size={16}/></button></div>
      </aside>}
      <div className="workspace">
        <header className="workspace-header"><div className="breadcrumb">{!sidebarOpen && <button className="icon-button" title="展开侧栏" onClick={() => setSidebarOpen(true)}><PanelLeftOpen size={17}/></button>}<LibraryIcon size={16}/><span>科研工作台</span><ChevronRight size={13}/><strong>{library.name}</strong></div><div className="workspace-header-actions"><span className="local-badge"><span className="live-dot"/>本地已连接</span><button className="icon-button" title="切换浅色 / 深色" onClick={() => void savePreferences({ theme: preferences.theme === 'dark' ? 'light' : 'dark' }).catch(notify)}>{preferences.theme === 'dark' ? <Sun size={17}/> : <Moon size={17}/>}</button><button className="icon-button" title="使用说明" onClick={() => setModal('help')}><CircleHelp size={17}/></button></div></header>
        <div className="workspace-tabbar"><div className="workspace-tab"><GitBranch size={15}/><span>领域论文</span><span className="tab-count">{library.papers.length}</span></div><span className="tab-trailing">RESEARCH WORKSPACE</span></div>
        <div className="research-heading"><div><div className="eyebrow"><span/>LITERATURE ATLAS</div><h1>{library.name}</h1><p>连接前沿论文与基础工作，建立自己的阅读路径。</p></div><div className="heading-actions"><span className={`source-badge ${library.demo ? 'demo' : ''}`}>{library.demo ? '示例文献' : library.updatedAt ? 'OpenAlex · 联网题录' : '等待首次检索'}</span><button className="button" onClick={() => void window.toolbox2.exportList(readingList(library, workspace.annotations), library.name).then(ok => { if (ok) notify('阅读清单已导出'); }).catch(notify)} disabled={!library.papers.length}><Download size={15}/>导出清单</button></div></div>
        <form className="research-search" onSubmit={e => { e.preventDefault(); void search(); }}><Search size={19}/><input ref={searchRef} aria-label="研究领域或交叉主题" value={query} onChange={e => setQuery(e.target.value)} placeholder="输入领域或交叉主题，例如：graph learning for scientific discovery"/><span className="search-source">OpenAlex<ChevronDown size={12}/></span><button className="button primary" disabled={searching}>{searching ? <LoaderCircle size={15} className="spin"/> : <Sparkles size={15}/>}<span>{searching ? '正在检索…' : '检索论文'}</span></button></form>
        <div className="research-stats"><span><strong>{library.papers.length}</strong>篇文献</span><i/><span><strong>{reading}</strong>篇阅读中</span><i/><span><strong>{completed}</strong>篇已读</span><i/><span><strong>{visits}</strong>次访问</span><span className="stats-update">{library.demo ? '示例集用于体验；点击检索获取最新文献' : library.updatedAt ? `更新于 ${new Date(library.updatedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}` : '支持单领域与交叉领域检索'}</span></div>
        <div className="workspace-content">
          <main className="paper-main">
            <div className="paper-toolbar"><div className="view-segment" role="group" aria-label="论文视图"><button className={preferences.view === 'table' ? 'active' : ''} onClick={() => void savePreferences({ view: 'table' }).catch(notify)}><Table2 size={15}/>表格</button><button className={preferences.view === 'graph' ? 'active' : ''} onClick={() => void savePreferences({ view: 'graph' }).catch(notify)}><Network size={15}/>关系图谱</button></div><div className="toolbar-space"/><div className="sort-control"><ArrowDownWideNarrow size={14}/><select aria-label="论文排序" value={sort} onChange={e => setSort(e.target.value)}><option value="frontier">最新发表优先</option><option value="cited">引用次数优先</option><option value="visits">访问次数优先</option></select></div><button className="icon-button" title={preferences.detailOpen ? '收起详情' : '展开详情'} onClick={() => void savePreferences({ detailOpen: !preferences.detailOpen }).catch(notify)}>{preferences.detailOpen ? <PanelRightClose size={17}/> : <PanelRightOpen size={17}/>}</button></div>
            <div className="filter-toolbar"><div className="filter-tabs">{[['all', '全部'], ['unread', '未读'], ['reading', '阅读中'], ['pinned', '已收藏']].map(([id, label]) => <button key={id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>{id === 'pinned' && <Bookmark size={12}/>} {label}{id === 'all' && <small>{library.papers.length}</small>}</button>)}</div><div className="filter-input"><Search size={13}/><input ref={filterRef} aria-label="筛选当前文献" placeholder="筛选标题、作者…" value={textFilter} onChange={e => setTextFilter(e.target.value)}/></div></div>
            <div className={`papers-area ${searching ? 'is-searching' : ''}`}>
              {searching && <div className="search-progress"><LoaderCircle className="spin" size={15}/>正在查找相关论文，原有文献会保留到检索完成</div>}
              {!papers.length ? <div className="empty-state"><div className="empty-art"><BookOpen size={32}/><span><Plus size={13}/></span></div><h2>{library.papers.length ? '没有符合条件的文献' : '从一个研究问题开始'}</h2><p>{library.papers.length ? '试着切换筛选条件，或调整关键词。' : '输入学科、研究问题或交叉方向，建立第一份领域文献清单。'}</p><button className="button" onClick={() => { if (library.papers.length) { setFilter('all'); setTextFilter(''); } else { searchRef.current?.focus(); searchRef.current?.select(); } }}>{library.papers.length ? '清除筛选' : '输入研究主题'}<ArrowRight size={15}/></button></div>
              : preferences.view === 'graph' ? <Graph papers={papers} annotations={workspace.annotations} selected={selected?.id || ''} onSelect={selectPaper}/>
              : <div className="table-scroll"><table className="paper-table"><colgroup><col className="rank-col"/><col/><col className="year-col"/><col className="status-col"/><col className="heat-col"/></colgroup><thead><tr><th>#</th><th>论文 / 来源</th><th>年份</th><th>状态</th><th>访问热度</th></tr></thead><tbody>{papers.map((p, i) => { const a = annotation(p.id); return <tr key={p.id} className={selected?.id === p.id ? 'selected' : ''} tabIndex={0} aria-label={`查看 ${p.title}`} onClick={() => selectPaper(p)} onKeyDown={e => { if (e.key === 'Enter') selectPaper(p); }}><td className="rank-cell">{String(i + 1).padStart(2, '0')}</td><td><div className="table-title">{a.pinned && <Bookmark size={12} className="pin-icon" fill="currentColor"/>}{p.title}</div><div className="table-subtitle"><span>{p.venue}</span><i/>{p.authors[0] || '作者未知'}{p.authors.length > 1 ? ' et al.' : ''}{p.openAccess && <small>OA</small>}</div></td><td className="year-cell">{p.year || '—'}{i === 0 && sort === 'frontier' && <span className="newest-label">最新</span>}</td><td><span className={`status-pill ${a.status}`}><span/>{statusLabels[a.status]}</span></td><td><span className="heat-value"><i style={{ background: heat(a.visits), boxShadow: `0 0 0 3px color-mix(in srgb, ${heat(a.visits)} 12%, transparent)` }}/>{a.visits}<small>次</small></span></td></tr>; })}</tbody></table></div>}
            </div>
            <footer className="paper-footer"><span>显示 {papers.length} / {library.papers.length} 篇</span><div className="heat-legend"><span>访问热度</span><i/>少<span>→</span>多</div></footer>
          </main>
          {showDetail && <><div className="panel-resizer" role="separator" aria-label="调整详情面板宽度" aria-orientation="vertical" aria-valuenow={detailWidth} tabIndex={0} onPointerDown={e => { resize.current = { x: e.clientX, width: detailWidth }; document.body.classList.add('resizing'); }} onKeyDown={e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); void savePreferences({ detailWidth: detailWidth + (e.key === 'ArrowLeft' ? 20 : -20) }).catch(notify); } }}/><div className="detail-host" style={{ width: detailWidth }}><Detail paper={selected!} annotation={annotation(selected!.id)} related={related} onChange={updateAnnotation} onClose={() => void savePreferences({ detailOpen: false }).catch(notify)} onSelect={selectPaper} onError={notify}/></div></>}
        </div>
        <footer className="app-statusbar"><span><span className="live-dot"/>Node 工作区已连接</span><span>本地保存 · 独立预览空间</span><span className="statusbar-right"><Command size={11}/> Ctrl K 检索</span></footer>
      </div>
    </div>
    {toast && <div className="toast" role="status"><Check size={16}/><span>{toast}</span><button onClick={() => setToast('')} title="关闭提示"><X size={14}/></button></div>}
    {modal && <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setModal(null); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close icon-button" title="关闭" onClick={() => setModal(null)}><X size={18}/></button>{modal === 'new' ? <form onSubmit={e => void createLibrary(e)}><div className="modal-icon"><FolderPlus size={25}/></div><h2 id="modal-title">新建研究资料库</h2><p>围绕一个领域、交叉主题或研究问题整理文献。</p><label>资料库名称<input autoFocus value={libraryName} maxLength={60} onChange={e => setLibraryName(e.target.value)} placeholder="例如：图学习 × 气候科学" required/></label><label>检索主题<input value={libraryQuery} maxLength={400} onChange={e => setLibraryQuery(e.target.value)} placeholder="graph learning climate science" minLength={2} required/></label><div className="modal-footer"><button type="button" className="button" onClick={() => setModal(null)}>取消</button><button className="button primary" disabled={creating}>{creating && <LoaderCircle className="spin" size={15}/>}创建资料库</button></div></form> : <><div className="modal-icon"><Sparkles size={25}/></div><h2 id="modal-title">研究，更有条理</h2><p>Toolbox 2 · 科研工作台预览</p><ul className="help-list"><li><Search size={18}/><div><strong>检索领域</strong><span>Ctrl K 定位主题输入框，联网获取最新发表的论文。中文和英文都可以尝试。</span></div></li><li><Network size={18}/><div><strong>建立阅读路径</strong><span>表格中比较论文，图谱中拖动节点。实线来自引用记录，虚线表示共享主题。</span></div></li><li><PenTool size={18}/><div><strong>沉淀自己的理解</strong><span>点击论文累计热度，右侧记录笔记、标记阅读状态和收藏；数据在本机保存。</span></div></li></ul><button className="button primary help-start" onClick={() => setModal(null)}>开始探索<ArrowRight size={15}/></button></>}</section></div>}
  </div>;
}
