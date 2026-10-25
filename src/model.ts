import type { Annotation, Library, Paper } from '../shared/types';
export const emptyAnnotation: Annotation = { visits: 0, status: 'unread', note: '', pinned: false };
export const statusLabels = { unread: '未读', reading: '阅读中', done: '已读' } as const;
export function heat(visits: number) { return `hsl(${Math.round(142 - Math.min(visits / 12, 1) * 142)} 63% 57%)`; }
export function linksFor(papers: Paper[]) {
  const edges: { source: string; target: string; kind: 'citation' | 'topic'; label: string }[] = [];
  const ids = new Set(papers.map(p => p.id)); const seen = new Set<string>();
  papers.forEach(p => p.references.filter(r => ids.has(r) && r !== p.id).forEach(r => { const key = [p.id, r].sort().join('|'); if (!seen.has(key)) { seen.add(key); edges.push({ source: p.id, target: r, kind: 'citation', label: '文献记录的引用关系' }); } }));
  papers.forEach((p, i) => {
    let added = 0;
    for (const other of papers.slice(i + 1)) {
      const shared = p.topics.filter(t => other.topics.includes(t)); const key = [p.id, other.id].sort().join('|');
      if (shared.length && added < 2 && !seen.has(key)) { seen.add(key); edges.push({ source: p.id, target: other.id, kind: 'topic', label: `共享主题：${shared.slice(0, 2).join('、')}` }); added++; }
    }
  }); return edges;
}
export function readingList(library: Library, annotations: Record<string, Annotation>) {
  return `# ${library.name}\n\n检索主题：${library.query}\n来源：${library.demo ? '示例文献' : 'OpenAlex'}\n\n` + library.papers.map(p => {
    const a = annotations[p.id] || emptyAnnotation;
    return `## ${p.title}\n\n${p.year || '年份未知'} · ${p.authors.join(', ')}\n\n[打开论文](${p.url})\n\n阅读状态：${statusLabels[a.status]} · 点击：${a.visits} 次\n\n${a.note || '暂无阅读笔记'}\n`;
  }).join('\n---\n\n');
}
