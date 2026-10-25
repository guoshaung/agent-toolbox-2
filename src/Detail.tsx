import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronRight,
  FileText,
  Link2,
  NotebookPen,
  X,
} from 'lucide-react';
import type { Annotation, Paper } from '../shared/types';
import { emptyAnnotation, statusLabels } from './model';
export function Detail({
  paper,
  annotation = emptyAnnotation,
  related,
  onChange,
  onClose,
  onSelect,
  onError,
}: {
  paper: Paper;
  annotation?: Annotation;
  related: Paper[];
  onChange(id: string, patch: Partial<Annotation>): Promise<void>;
  onClose(): void;
  onSelect(p: Paper): void;
  onError(error: unknown): void;
}) {
  const [draft, setDraft] = useState(annotation.note),
    [saving, setSaving] = useState(false),
    [saved, setSaved] = useState(true);
  const lastSaved = useRef(annotation.note),
    currentPaper = useRef(paper.id),
    saveSequence = useRef(0);
  useEffect(() => {
    currentPaper.current = paper.id;
    lastSaved.current = annotation.note;
    setDraft(annotation.note);
    setSaved(true);
    setSaving(false);
  }, [paper.id]);
  const save = async (value: string, id: string) => {
    if (value === lastSaved.current && id === currentPaper.current) return;
    const sequence = ++saveSequence.current;
    setSaving(true);
    try {
      await onChange(id, { note: value });
      if (sequence === saveSequence.current && id === currentPaper.current) {
        lastSaved.current = value;
        setSaved(true);
      }
    } catch (error) {
      onError(error);
      setSaved(false);
    } finally {
      if (sequence === saveSequence.current) setSaving(false);
    }
  };
  useEffect(() => {
    if (draft === lastSaved.current) return;
    const timer = setTimeout(() => {
      void save(draft, paper.id);
    }, 650);
    return () => clearTimeout(timer);
  }, [draft, paper.id]);
  return (
    <aside className="detail-panel">
      <div className="detail-top">
        <span>
          <FileText size={15} />
          文献详情
        </span>
        <button className="icon-button" title="收起详情" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div className="detail-scroll">
        <div className="paper-type">
          <span>{paper.source === '示例文献' ? '示例文献' : '研究文献'}</span>
          <span>{paper.year}</span>
        </div>
        <h2>{paper.title}</h2>
        <p className="detail-authors">{paper.authors.join(' · ') || '未提供作者信息'}</p>
        <div className="venue-line">
          <span>{paper.venue}</span>
          {paper.openAccess && <span className="oa-badge">开放获取</span>}
        </div>
        <div className="detail-actions">
          <button
            className="button primary"
            onClick={() => void window.toolbox2.openExternal(paper.url).catch(onError)}
          >
            打开原文
            <ArrowUpRight size={15} />
          </button>
          <button
            className={`button square ${annotation.pinned ? 'is-pinned' : ''}`}
            title={annotation.pinned ? '取消收藏' : '收藏论文'}
            onClick={() => void onChange(paper.id, { pinned: !annotation.pinned }).catch(onError)}
          >
            <Bookmark size={17} fill={annotation.pinned ? 'currentColor' : 'none'} />
          </button>
        </div>
        <div className="read-status">
          <span>阅读状态</span>
          <select
            value={annotation.status}
            onChange={(e) =>
              void onChange(paper.id, { status: e.target.value as Annotation['status'] }).catch(
                onError,
              )
            }
          >
            {Object.entries(statusLabels).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <section className="detail-section">
          <h3>研究主题</h3>
          <div className="topic-tags">
            {paper.topics.length ? (
              paper.topics.map((t) => <span key={t}>{t}</span>)
            ) : (
              <span>暂无主题标签</span>
            )}
          </div>
        </section>
        <section className="detail-section">
          <h3>摘要</h3>
          <p className="abstract">
            {paper.abstract || '数据源暂未提供摘要。可以打开论文原文，或在下方记录你的阅读摘要。'}
          </p>
        </section>
        <section className="detail-section notes-section">
          <h3>
            <span>
              <NotebookPen size={14} />
              阅读笔记
            </span>
            <small className={!saved && !saving ? 'note-dirty' : ''}>
              {saving ? (
                '保存中…'
              ) : saved ? (
                <>
                  <Check size={11} />
                  已保存
                </>
              ) : (
                '待保存'
              )}
            </small>
          </h3>
          <textarea
            aria-label="阅读笔记"
            placeholder="记下核心方法、局限，或者下次想追问的问题…"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setSaved(false);
            }}
            onBlur={() => void save(draft, paper.id)}
          />
          <div className="note-foot">本机保存 · 随时续读</div>
        </section>
        {related.length > 0 && (
          <section className="detail-section">
            <h3>
              <span>
                <Link2 size={14} />
                相关文献
              </span>
            </h3>
            <div className="related-list">
              {related.slice(0, 3).map((p) => (
                <button key={p.id} onClick={() => onSelect(p)}>
                  <span>{p.title}</span>
                  <ChevronRight size={14} />
                </button>
              ))}
            </div>
          </section>
        )}
        {paper.doi && <p className="doi-line">DOI · {paper.doi}</p>}
      </div>
    </aside>
  );
}
