export type ReadStatus = 'unread' | 'reading' | 'done';
export interface Paper {
  id: string;
  title: string;
  year: number;
  date: string;
  authors: string[];
  venue: string;
  doi: string;
  url: string;
  abstract: string;
  cited: number;
  topics: string[];
  references: string[];
  openAccess: boolean;
  source: string;
}
export interface Library {
  id: string;
  name: string;
  query: string;
  color: string;
  papers: Paper[];
  updatedAt: string | null;
  demo: boolean;
}
export interface Annotation {
  visits: number;
  note: string;
  status: ReadStatus;
  pinned: boolean;
}
export interface Preferences {
  theme: 'dark' | 'light';
  view: 'table' | 'graph';
  detailWidth: number;
  detailOpen: boolean;
  activeLibrary: string;
}
export interface Workspace {
  version: 1;
  libraries: Library[];
  annotations: Record<string, Annotation>;
  preferences: Preferences;
}
export interface SearchRequest {
  libraryId: string;
  query: string;
  limit?: number;
}
export interface SearchResult {
  workspace: Workspace;
  count: number;
  total: number;
}
export type ApiPath =
  | '/workspace'
  | '/health'
  | '/search'
  | '/visit'
  | '/annotation'
  | '/preferences'
  | '/libraries';
export interface DesktopBridge {
  request<T>(route: ApiPath, body?: unknown): Promise<T>;
  window(action: 'minimize' | 'maximize' | 'close'): void;
  openExternal(url: string): Promise<void>;
  exportList(content: string, name: string): Promise<boolean>;
  version(): Promise<string>;
  legacy<T>(scope: LegacyScope, action: LegacyAction, payload?: unknown): Promise<T>;
}
export type LegacyScope = 'system' | 'ai' | 'drawing' | 'research' | 'dsh' | 'container' | 'skill';
export type LegacyAction =
  | 'status'
  | 'connect'
  | 'copyText'
  | 'start'
  | 'stop'
  | 'refresh'
  | 'test'
  | 'update'
  | 'copyKey'
  | 'qr'
  | 'open'
  | 'openFile'
  | 'openTool'
  | 'list'
  | 'read'
  | 'write'
  | 'targets'
  | 'mkdir'
  | 'organize'
  | 'applyPlan'
  | 'pickImport'
  | 'probe'
  | 'run'
  | 'stopRun'
  | 'runStatus'
  | 'runLog'
  | 'bot'
  | 'setBot';
export interface LegacyStatus {
  connected: boolean;
  protocol: number;
  version?: string;
  preferences: { typography: string; scale: string };
  message?: string;
}
export interface Quota {
  remaining?: number;
  unit?: string;
  plan?: string;
  source: string;
  updatedAt: string;
  resetAt?: string;
  windows?: {
    label: string;
    usedPercent?: number;
    lessThanOnePercent?: boolean;
    resetAt?: string;
    usedText?: string;
    totalText?: string;
  }[];
  pools?: { name: string; remaining: number }[];
}
export interface Channel {
  id: string;
  name: string;
  source: string;
  provider: string;
  model: string;
  models?: string[];
  enabled: boolean;
  priority: number;
  ready: boolean;
  hasKey: boolean;
  cooldownUntil: number;
  accountNote?: string;
  quota: Quota | null;
  quotaPath?: string;
  stats: {
    completed: number;
    failures: number;
    inputTokens: number;
    outputTokens: number;
    usageResponses: number;
  };
}
export interface HubStatus {
  running: boolean;
  baseUrl: string;
  inflight: number;
  channels: Channel[];
  requests: { id?: string; at: string; channel: string; result: string; elapsedMs: number }[];
}
export interface DrawingStatus {
  enabled: boolean;
  identity: { id: string; code: string; name: string };
  clients: number;
  remoteClients: number;
  sequence: number;
  desktopUrl: string;
  urls: string[];
  qr?: string;
}
declare global {
  interface Window {
    toolbox2: DesktopBridge;
  }
}
