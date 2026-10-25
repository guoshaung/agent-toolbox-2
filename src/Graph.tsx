import { useEffect, useMemo, useRef, useState } from 'react';
import { Focus, Minus, Plus } from 'lucide-react';
import type { Annotation, Paper } from '../shared/types';
import { heat, linksFor } from './model';
type Point = { x: number; y: number };
const layout = (papers: Paper[], width = 1000, height = 620) =>
  Object.fromEntries(
    papers.map((p, i) => {
      const angle = i * 2.39996,
        distance = 0.35 + 0.65 * Math.sqrt(i / Math.max(1, papers.length - 1));
      return [
        p.id,
        {
          x: width / 2 + Math.cos(angle) * (width * 0.35) * distance,
          y: height * 0.43 + Math.sin(angle) * Math.max(55, height * 0.29) * distance,
        },
      ];
    }),
  );
export function Graph({
  papers,
  annotations,
  selected,
  onSelect,
}: {
  papers: Paper[];
  annotations: Record<string, Annotation>;
  selected: string;
  onSelect(p: Paper): void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [positions, setPositions] = useState<Record<string, Point>>(() => layout(papers));
  const [transform, setTransform] = useState({ x: 0, y: 0, zoom: 1 });
  const [viewport, setViewport] = useState({ width: 1000, height: 620 });
  const drag = useRef<{ id: string; x: number; y: number; start: Point; moved: boolean } | null>(
    null,
  );
  const edges = useMemo(() => linksFor(papers), [papers]);
  const paperIds = papers.map((p) => p.id).join('|');
  useEffect(() => {
    setPositions(layout(papers, viewport.width, viewport.height));
    setTransform({ x: 0, y: 0, zoom: 1 });
  }, [paperIds, viewport.width, viewport.height]);
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const { width, height } = element.getBoundingClientRect();
      if (width > 0 && height > 0) setViewport({ width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      setTransform((t) => ({
        ...t,
        zoom: Math.max(0.45, Math.min(2.6, t.zoom * (e.deltaY > 0 ? 0.91 : 1.1))),
      }));
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, []);
  const begin = (e: React.PointerEvent<SVGElement>, id = '') => {
    if (e.button !== 0) return;
    e.stopPropagation();
    svg.current?.setPointerCapture(e.pointerId);
    drag.current = {
      id,
      x: e.clientX,
      y: e.clientY,
      start: id ? positions[id] : { x: transform.x, y: transform.y },
      moved: false,
    };
  };
  return (
    <div className="graph-stage">
      <div className="graph-caption">
        <span className="tiny-kicker">KNOWLEDGE MAP</span>
        <span>
          {papers.length} 个节点 · {edges.length} 条关联
        </span>
      </div>
      <svg
        ref={svg}
        className="graph-svg"
        viewBox={`0 0 ${viewport.width} ${viewport.height}`}
        role="img"
        aria-label="可拖动、缩放的论文关系图"
        onPointerDown={(e) => begin(e)}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const scale =
              viewport.width / (svg.current?.getBoundingClientRect().width || viewport.width),
            dx = (e.clientX - d.x) * scale,
            dy = (e.clientY - d.y) * scale;
          if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
          if (d.id)
            setPositions((p) => ({
              ...p,
              [d.id]: { x: d.start.x + dx / transform.zoom, y: d.start.y + dy / transform.zoom },
            }));
          else setTransform((t) => ({ ...t, x: d.start.x + dx, y: d.start.y + dy }));
        }}
        onPointerUp={() => {
          const d = drag.current;
          drag.current = null;
          if (d?.id && !d.moved) {
            const p = papers.find((p) => p.id === d.id);
            if (p) onSelect(p);
          }
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <g
          transform={`translate(${transform.x + (viewport.width / 2) * (1 - transform.zoom)} ${transform.y + (viewport.height / 2) * (1 - transform.zoom)}) scale(${transform.zoom})`}
        >
          {edges.map((e, i) => {
            const a = positions[e.source],
              b = positions[e.target];
            if (!a || !b) return null;
            const active = e.source === selected || e.target === selected;
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                className={`graph-edge ${e.kind} ${active ? 'connected' : ''}`}
              >
                <title>{e.label}</title>
              </line>
            );
          })}
          {papers.map((p) => {
            const point = positions[p.id];
            if (!point) return null;
            const visits = annotations[p.id]?.visits || 0,
              active = p.id === selected;
            return (
              <g
                key={p.id}
                role="button"
                tabIndex={0}
                aria-label={`查看 ${p.title}`}
                className={`graph-node ${active ? 'selected' : ''}`}
                transform={`translate(${point.x} ${point.y})`}
                onPointerDown={(e) => begin(e, p.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(p);
                  }
                }}
              >
                {active && <circle r="28" className="graph-halo" />}
                <circle
                  r={active ? 13 : 8 + Math.min(annotations[p.id]?.visits || 0, 12) * 0.3}
                  fill={heat(visits)}
                  className="graph-dot"
                />
                <foreignObject x="-82" y="24" width="164" height="86">
                  <div className="graph-label">
                    <strong>{p.title}</strong>
                    <span>
                      {p.year} · {visits} 次访问
                    </span>
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </g>
      </svg>
      <div className="graph-bottom">
        <div className="graph-legend">
          <i className="line-sample" />
          引用关系
          <i className="line-sample dashed" />
          主题相近
        </div>
        <div className="zoom-controls">
          <button
            title="缩小"
            onClick={() => setTransform((t) => ({ ...t, zoom: Math.max(0.45, t.zoom - 0.15) }))}
          >
            <Minus size={15} />
          </button>
          <span>{Math.round(transform.zoom * 100)}%</span>
          <button
            title="放大"
            onClick={() => setTransform((t) => ({ ...t, zoom: Math.min(2.6, t.zoom + 0.15) }))}
          >
            <Plus size={15} />
          </button>
          <button title="适应画布" onClick={() => setTransform({ x: 0, y: 0, zoom: 1 })}>
            <Focus size={16} />
          </button>
        </div>
      </div>
      <p className="graph-hint">拖动节点整理关系 · 拖动画布移动 · 滚轮缩放</p>
    </div>
  );
}
