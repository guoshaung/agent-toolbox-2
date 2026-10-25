export type ReadStatus = 'unread' | 'reading' | 'done';
export interface Paper {
  id: string; title: string; year: number; date: string; authors: string[];
  venue: string; doi: string; url: string; abstract: string; cited: number;
  topics: string[]; references: string[]; openAccess: boolean; source: string;
}
export interface Library { id: string; name: string; query: string; color: string; papers: Paper[]; updatedAt: string | null; demo: boolean }
export interface Annotation { visits: number; note: string; status: ReadStatus; pinned: boolean }
export interface Preferences { theme: 'dark' | 'light'; view: 'table' | 'graph'; detailWidth: number; detailOpen: boolean; activeLibrary: string }
export interface Workspace { version: 1; libraries: Library[]; annotations: Record<string, Annotation>; preferences: Preferences }
export interface SearchRequest { libraryId: string; query: string; limit?: number }
export interface SearchResult { workspace: Workspace; count: number; total: number }
export type ApiPath = '/workspace' | '/health' | '/search' | '/visit' | '/annotation' | '/preferences' | '/libraries';
export interface DesktopBridge {
  request<T>(route: ApiPath, body?: unknown): Promise<T>;
  window(action: 'minimize' | 'maximize' | 'close'): void;
  openExternal(url: string): Promise<void>;
  exportList(content: string, name: string): Promise<boolean>;
  version(): Promise<string>;
}
declare global { interface Window { toolbox2: DesktopBridge } }
