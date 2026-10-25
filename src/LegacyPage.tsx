import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Check,
  ChevronDown,
  Clipboard,
  Link2,
  LoaderCircle,
  PenTool,
  Play,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Square,
  Zap,
} from 'lucide-react';
import type { Channel, DrawingStatus, HubStatus, LegacyStatus, Quota } from '../shared/types';

export type Module = 'research' | 'ai' | 'drawing';
const stamp = (value?: string) =>
  value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleString() : '时间未提供';
const count = (value: number) => value.toLocaleString();
function QuotaView({ quota }: { quota: Quota | null }) {
  if (!quota)
    return (
      <div className="quota-unknown">
        额度未知<span>尚无可用数据；可尝试刷新</span>
      </div>
    );
  return (
    <div className="quota-content">
      <div className="quota-number">
        {quota.windows ? (
          quota.plan || '账户额度'
        ) : typeof quota.remaining === 'number' ? (
          <>
            {count(quota.remaining)} <small>{quota.unit || 'credits'}</small>
          </>
        ) : (
          '额度未知'
        )}
      </div>
      {quota.windows?.map((item, i) => (
        <div className="quota-window" key={i}>
          <div>
            <span>{item.label}</span>
            <strong>已用 {item.lessThanOnePercent ? '<1' : (item.usedPercent ?? '未知')}%</strong>
          </div>
          {typeof item.usedPercent === 'number' && (
            <progress
              aria-label={`${item.label}已用比例`}
              value={Math.min(100, Math.max(0, item.usedPercent))}
              max={100}
            />
          )}
          {(item.usedText || item.resetAt) && (
            <small>
              {item.usedText && `${item.usedText} / ${item.totalText || '未知'}`}
              {item.resetAt && ` · 重置 ${stamp(item.resetAt)}`}
            </small>
          )}
        </div>
      ))}
      {quota.pools && (
        <div className="quota-pools">
          {quota.pools.map((item) => (
            <span key={item.name}>
              {item.name}
              <b>{count(item.remaining)}</b>
            </span>
          ))}
        </div>
      )}
      <span className="quota-time">
        {quota.source === 'api' ? '接口查询' : '手动记录'} · {stamp(quota.updatedAt)}
      </span>
    </div>
  );
}
function ChannelCard({
  channel: c,
  busy,
  run,
}: {
  channel: Channel;
  busy: boolean;
  run: (action: 'refresh' | 'test' | 'update', payload: unknown) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [model, setModel] = useState(c.model),
    [priority, setPriority] = useState(c.priority),
    [enabled, setEnabled] = useState(c.enabled);
  const editableModels = c.models?.length ? c.models : [c.model];
  const cooldown = c.cooldownUntil > Date.now();
  return (
    <article className="channel-card">
      <div className="channel-title">
        <div className="provider-icon">{c.name.slice(0, 1)}</div>
        <div>
          <h2>{c.name}</h2>
          <span>{c.source === 'current' ? '原工具箱 API' : c.provider}</span>
        </div>
        <span className={`state-pill ${c.enabled && c.ready && !cooldown ? 'good' : ''}`}>
          {!c.enabled ? '已停用' : cooldown ? '冷却中' : c.ready ? '可调度' : '待连接'}
        </span>
      </div>
      <QuotaView quota={c.quota} />
      <div className="channel-routing">
        <span>当前模型</span>
        <code title={c.model}>{c.model || '尚未选择'}</code>
        <span>
          优先级 <b>{c.priority}</b>
        </span>
      </div>
      <div className="channel-actions">
        <button className="button" disabled={busy} onClick={() => void run('refresh', c.id)}>
          <RefreshCw size={14} />
          刷新额度
        </button>
        <button
          className="button"
          disabled={busy}
          onClick={() => {
            setModel(c.model);
            setPriority(c.priority);
            setEnabled(c.enabled);
            setEditing((v) => !v);
          }}
        >
          模型与调度
          <ChevronDown size={13} />
        </button>
      </div>
      {editing && (
        <form
          className="channel-editor"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run('update', { id: c.id, model, priority, enabled })) setEditing(false);
          }}
        >
          <label>
            上游模型
            {c.models?.length ? (
              <select value={model} onChange={(e) => setModel(e.target.value)}>
                {editableModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : (
              <input value={model} maxLength={150} onChange={(e) => setModel(e.target.value)} />
            )}
          </label>
          <label>
            调用优先级（小的优先）
            <input
              type="number"
              min={0}
              max={999}
              required
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            启用并加入自动调度
          </label>
          <div className="module-actions">
            <button className="button primary" disabled={busy}>
              <Check size={14} />
              保存
            </button>
            <button type="button" className="button" onClick={() => setEditing(false)}>
              取消
            </button>
          </div>
        </form>
      )}
      <details className="channel-details">
        <summary>调用详情与测试</summary>
        <p>{c.accountNote || (c.hasKey ? '已使用原有凭据。' : '登录或密钥暂不可用。')}</p>
        <p>
          网关成功 {c.stats.completed} 次 · 失败 {c.stats.failures} 次
        </p>
        <p>
          {c.stats.usageResponses
            ? `已报告输入 ${count(c.stats.inputTokens)} / 输出 ${count(c.stats.outputTokens)} Token`
            : '上游尚未报告 Token 用量'}
          ；不代表原应用总用量。
        </p>
        <code>指定模型 ID：{c.id}</code>
        <button
          className="button"
          disabled={busy || !c.ready}
          onClick={() => void run('test', c.id)}
        >
          发送测试（消耗少量额度）
          <ArrowRight size={14} />
        </button>
      </details>
    </article>
  );
}
export function LegacyPage({
  kind,
  legacy,
  onConnect,
  onDisconnected,
  notify,
}: {
  kind: 'ai' | 'drawing';
  legacy: LegacyStatus | null;
  onConnect: () => Promise<void>;
  onDisconnected: () => void;
  notify: (error: unknown) => void;
}) {
  const [hub, setHub] = useState<HubStatus | null>(null),
    [drawing, setDrawing] = useState<DrawingStatus | null>(null);
  const [busy, setBusy] = useState(''),
    [error, setError] = useState(''),
    [pairOpen, setPairOpen] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState(''),
    [qr, setQr] = useState('');
  const remoteSeen = useRef(false),
    mounted = useRef(true),
    operation = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true,
      pending = false;
    async function refresh() {
      if (!legacy?.connected || pending || operation.current) return;
      pending = true;
      try {
        if (kind === 'ai') {
          const value = await window.toolbox2.legacy<HubStatus>('ai', 'status');
          if (active) setHub(value);
        } else {
          const value = await window.toolbox2.legacy<DrawingStatus>('drawing', 'status');
          if (active) setDrawing(value);
        }
        if (active) setError('');
      } catch (e) {
        if (active) {
          setError(String((e as Error).message));
          onDisconnected();
        }
      } finally {
        pending = false;
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [legacy?.connected, kind]);
  useEffect(() => {
    if ((drawing?.remoteClients || 0) > 0 && !remoteSeen.current) setPairOpen(false);
    remoteSeen.current = (drawing?.remoteClients || 0) > 0;
  }, [drawing?.remoteClients]);
  const urls = drawing?.urls || [];
  const chosen = urls.includes(selectedUrl) ? selectedUrl : urls[0] || '';
  useEffect(() => {
    let active = true;
    setQr('');
    if (kind === 'drawing' && pairOpen && chosen && drawing?.enabled && legacy?.connected)
      window.toolbox2
        .legacy<string>('drawing', 'qr', chosen)
        .then((value) => {
          if (active) setQr(value);
        })
        .catch((e) => {
          if (active) notify(e);
        });
    return () => {
      active = false;
    };
  }, [pairOpen, chosen, drawing?.enabled, legacy?.connected, kind]);
  async function act(
    action: 'start' | 'stop' | 'refresh' | 'test' | 'update' | 'copyKey',
    payload?: unknown,
  ) {
    if (operation.current) return false;
    operation.current = true;
    setBusy(action);
    setError('');
    try {
      const result = await window.toolbox2.legacy<any>(kind, action, payload);
      if (mounted.current) {
        if (kind === 'ai' && result.channels) setHub(result);
        if (kind === 'drawing' && typeof result.enabled === 'boolean') setDrawing(result);
        if (action === 'copyKey') notify('网关密钥已复制');
        if (action === 'update') notify('模型与调度已保存，原凭据已保留');
        if (action === 'test') notify(result.testReply || '测试成功');
        if (action === 'refresh') notify('已刷新，请查看额度更新时间');
      }
      return true;
    } catch (e) {
      if (mounted.current) {
        setError((e as Error).message);
        notify(e);
      }
      return false;
    } finally {
      operation.current = false;
      if (mounted.current) setBusy('');
    }
  }
  async function copy(value: string) {
    try {
      await window.toolbox2.legacy('system', 'copyText', value);
      notify('已复制');
    } catch (e) {
      notify(e);
    }
  }
  if (!legacy?.connected)
    return (
      <section className="module-offline">
        <div className="module-large-icon">
          {kind === 'ai' ? <Zap size={32} /> : <PenTool size={32} />}
        </div>
        <div className="eyebrow">CONNECT YOUR EXISTING WORKSPACE</div>
        <h1>{kind === 'ai' ? '接回你的额度中枢' : '继续在同一本上创作'}</h1>
        <p>
          {kind === 'ai'
            ? '使用原有 WorkBuddy、TRAE、豆包工作和 QwenWork 通道。'
            : '复用原设备 ID、iPad 配对和全部笔迹、图片。'}
        </p>
        <p className="module-caption">
          此阶段由旧工具箱提供服务，请保持它运行。原字体和凭据配置保留在原处。
        </p>
        <button
          className="button primary"
          disabled={!!busy}
          onClick={async () => {
            setBusy('connect');
            try {
              await onConnect();
            } finally {
              if (mounted.current) setBusy('');
            }
          }}
        >
          {busy ? <LoaderCircle size={17} className="spin" /> : <Link2 size={17} />}连接现有工具箱
        </button>
        {error && (
          <p role="alert" className="module-error">
            {error}
          </p>
        )}
      </section>
    );
  return (
    <div className={`module-page ${kind === 'drawing' ? 'drawing-module' : ''}`}>
      <div className="module-heading">
        <div>
          <div className="eyebrow">{kind === 'ai' ? 'MODEL GATEWAY' : 'DRAW TOGETHER'}</div>
          <h1>{kind === 'ai' ? '额度中枢' : '绘图同步'}</h1>
          <p>
            {kind === 'ai'
              ? '一个调用入口，各家独立记账。沿用已配置的模型与优先级。'
              : 'iPad 画笔与电脑图片，实时汇入同一本绘图本。'}
          </p>
        </div>
        <span className="shared-badge">
          <ShieldCheck size={15} />
          原配置已连接
        </span>
      </div>
      {error && (
        <div className="module-error" role="alert">
          {error}
          <button className="button" onClick={() => void onConnect()}>
            重新连接
          </button>
        </div>
      )}
      {kind === 'ai' ? (
        hub ? (
          <>
            <section className="gateway-card">
              <div className="gateway-top">
                <div>
                  <Activity size={20} />
                  <h2>本地统一接口</h2>
                  <span className={`state-pill ${hub.running ? 'good' : ''}`}>
                    {hub.running ? '运行中' : '已停止'}
                  </span>
                </div>
                <button
                  className={`button ${hub.running ? '' : 'primary'}`}
                  disabled={!!busy}
                  onClick={() => void act(hub.running ? 'stop' : 'start')}
                >
                  {busy === 'start' || busy === 'stop' ? (
                    <LoaderCircle className="spin" size={15} />
                  ) : hub.running ? (
                    <Square size={13} />
                  ) : (
                    <Play size={14} />
                  )}
                  {hub.running ? '停止网关' : '启动网关'}
                </button>
              </div>
              <div className="gateway-address">
                <code>{hub.baseUrl || 'http://127.0.0.1:18878/v1'}</code>
                <button
                  className="button"
                  disabled={!hub.running}
                  onClick={() => void copy(hub.baseUrl)}
                >
                  <Clipboard size={14} />
                  复制地址
                </button>
                <button
                  className="button"
                  disabled={!hub.running || !!busy}
                  onClick={() => void act('copyKey')}
                >
                  <Clipboard size={14} />
                  复制网关密钥
                </button>
              </div>
              <div className="gateway-foot">
                <span>
                  Model <code>auto</code> · 按优先级选择，限流时尝试下一可用通道
                </span>
                <span>仅本机监听 · Bearer 鉴权</span>
              </div>
            </section>
            <div className="hub-metrics">
              <div>
                <strong>
                  {hub.channels.filter((c) => c.ready && c.cooldownUntil <= Date.now()).length}
                  <small> / {hub.channels.length}</small>
                </strong>
                <span>可调度通道</span>
              </div>
              <div>
                <strong>{hub.inflight}</strong>
                <span>当前请求</span>
              </div>
              <div>
                <strong>{count(hub.channels.reduce((n, c) => n + c.stats.completed, 0))}</strong>
                <span>网关成功请求</span>
              </div>
              <p>
                各家额度单位不同，
                <br />
                分别展示实际查询结果。
              </p>
            </div>
            <div className="module-section-title">
              <h2>已接入的账户</h2>
              <span>
                {busy && <LoaderCircle className="spin" size={14} />}原登录态 · 原模型配置
              </span>
            </div>
            <div className="channel-grid">
              {hub.channels.map((c) => (
                <ChannelCard key={c.id} channel={c} busy={!!busy} run={act} />
              ))}
            </div>
            {!hub.channels.length && (
              <p className="module-caption">原工具箱暂无已配置通道，请先在原版额度中枢添加账号。</p>
            )}
            <details className="module-history">
              <summary>最近调用记录 · {hub.requests.length} 项</summary>
              {hub.requests.slice(0, 15).map((item, i) => (
                <div key={i}>
                  <time>{stamp(item.at)}</time>
                  <strong>{item.channel}</strong>
                  <span>{item.result}</span>
                  <span>{(item.elapsedMs / 1000).toFixed(1)} s</span>
                </div>
              ))}
            </details>
          </>
        ) : (
          <div className="module-loading">
            <LoaderCircle className="spin" size={22} />
            正在读取原额度中枢…
          </div>
        )
      ) : drawing ? (
        <>
          <section className="drawing-connection">
            <div>
              <span className={`state-pill ${drawing.enabled ? 'good' : ''}`}>
                {drawing.enabled
                  ? drawing.remoteClients
                    ? 'iPad 已连接'
                    : '等待 iPad'
                  : '同步未启动'}
              </span>
              <span className="device-label">
                <Smartphone size={15} />
                设备 {drawing.identity.code}
              </span>
              <span className="module-caption">已提交 {drawing.sequence} 项操作</span>
            </div>
            <div className="module-actions">
              <button
                className="button"
                disabled={!drawing.enabled}
                aria-expanded={pairOpen}
                onClick={() => setPairOpen((v) => !v)}
              >
                <QrCode size={15} />
                {pairOpen ? '收起配对' : '配对设备'}
              </button>
              <button
                className={`button ${drawing.enabled ? '' : 'primary'}`}
                disabled={!!busy}
                onClick={() => void act(drawing.enabled ? 'stop' : 'start')}
              >
                {busy && <LoaderCircle className="spin" size={15} />}
                {drawing.enabled ? '停止同步' : '打开绘图本并启用同步'}
              </button>
            </div>
          </section>
          {pairOpen && drawing.enabled && (
            <section className="pairing-panel">
              {qr ? (
                <img src={qr} alt="iPad 配对二维码" />
              ) : (
                <LoaderCircle className="spin" size={22} />
              )}
              <div>
                <h2>添加 iPad 或更换网络时配对</h2>
                <p>
                  已配对的 iPad 打开绘图本会自动重连，通常无需重新扫描。两台设备需能访问同一局域网。
                </p>
                <label>
                  本机网络地址
                  <select
                    aria-label="配对网络地址"
                    value={chosen}
                    onChange={(e) => setSelectedUrl(e.target.value)}
                  >
                    {urls.map((url) => (
                      <option value={url} key={url}>
                        {new URL(url).host}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="button" disabled={!chosen} onClick={() => void copy(chosen)}>
                  <Clipboard size={14} />
                  复制配对地址
                </button>
              </div>
            </section>
          )}
          {drawing.enabled && drawing.desktopUrl ? (
            <iframe
              className="drawing-frame"
              title="同步绘图本"
              src={drawing.desktopUrl}
              sandbox="allow-scripts allow-same-origin allow-downloads allow-forms"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="drawing-empty">
              <PenTool size={34} />
              <h2>准备好，接着上次画</h2>
              <p>启用后载入原绘图本；iPad 保留原配对，电脑粘贴的图片也会同步。</p>
              <button
                className="button primary"
                disabled={!!busy}
                onClick={() => void act('start')}
              >
                <Play size={15} />
                打开绘图本并启用同步
              </button>
            </div>
          )}
          <p className="drawing-tip">
            在画布内按 Ctrl V 粘贴图片 · iPad 使用原「Toolbox 绘图本」 ·
            关闭同步会断开连接，已保存内容保留
          </p>
        </>
      ) : (
        <div className="module-loading">
          <LoaderCircle className="spin" size={22} />
          正在读取原绘图本…
        </div>
      )}
    </div>
  );
}
