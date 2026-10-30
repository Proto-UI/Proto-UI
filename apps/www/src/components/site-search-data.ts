/** Pagefind is a data engine only. The caller owns import/probe timeouts and
 * locale-specific engine lifetime; this bridge owns no DOM, keyboard or focus. */
export interface PagefindResultData {
  url: string;
  meta?: { title?: string };
  sub_results?: Array<{ url: string; title?: string }>;
}
export interface SitePagefindHit {
  id: string;
  data(): Promise<PagefindResultData>;
}
export interface SitePagefindApi {
  search(query: string): Promise<{ results: SitePagefindHit[] }>;
}
export interface SiteSearchRow {
  id: string;
  title: string;
  href: string;
}
export interface SiteSearchSnapshot {
  query: string;
  phase: 'idle' | 'loading' | 'ready' | 'empty' | 'error';
  rows: readonly SiteSearchRow[];
  /** Count of ranked documents, not the number of expanded anchor rows. */
  resultCount: number;
  hasMore: boolean;
  loadingMore: boolean;
  moreError: boolean;
}

export function createSiteSearchData(options: {
  load(): Promise<SitePagefindApi>;
  origin: string;
  publish(snapshot: SiteSearchSnapshot): void;
  formatURL?(path: string): string;
  pageSize?: number;
}) {
  let alive = true;
  let revision = 0;
  let query = '';
  let hits: SitePagefindHit[] = [];
  let cursor = 0;
  let rows: SiteSearchRow[] = [];
  let loadingMore = false;
  let moreError = false;
  let phase: SiteSearchSnapshot['phase'] = 'idle';
  const requestedSize = options.pageSize ?? 20;
  const pageSize = Number.isFinite(requestedSize)
    ? Math.max(1, Math.min(100, Math.trunc(requestedSize)))
    : 20;
  const origin = new URL(options.origin).origin;
  const publish = () => {
    if (alive)
      options.publish({
        query,
        phase,
        // Consumers receive value snapshots, never the executable row objects.
        rows: rows.map((row) => ({ ...row })),
        resultCount: hits.length,
        hasMore: cursor < hits.length,
        loadingMore,
        moreError,
      });
  };
  const clear = () => {
    hits = [];
    cursor = 0;
    rows = [];
    loadingMore = false;
    moreError = false;
  };
  const href = (raw: string) => {
    const url = new URL(raw, options.origin);
    if (url.origin !== origin || !/^https?:$/.test(url.protocol))
      throw new Error('Search result must target the current site');
    const path = url.pathname + url.search + url.hash;
    const checked = new URL(options.formatURL?.(path) ?? path, options.origin);
    if (checked.origin !== origin || !/^https?:$/.test(checked.protocol))
      throw new Error('Formatted search result must target the current site');
    return checked.pathname + checked.search + checked.hash;
  };
  const loadPage = async (current: number, initial: boolean) => {
    const owns = () => alive && revision === current;
    const batch = hits.slice(cursor, cursor + pageSize);
    if (!owns() || loadingMore || !batch.length) return;
    loadingMore = !initial;
    moreError = false;
    if (!initial) publish();
    try {
      const data = await Promise.all(batch.map((hit) => hit.data()));
      if (!owns()) return;
      const next = [...rows];
      const seen = new Set(next.map((row) => row.href));
      data.forEach((page, index) => {
        const entries = [{ url: page.url, title: page.meta?.title }, ...(page.sub_results ?? [])];
        for (const entry of entries) {
          const path = href(entry.url);
          if (seen.has(path)) continue;
          seen.add(path);
          next.push({ id: `${batch[index]!.id}:${path}`, href: path, title: entry.title || path });
        }
      });
      // Commit cursor and rows together only after the entire page is valid.
      rows = next;
      cursor += batch.length;
      phase = rows.length ? 'ready' : 'empty';
    } catch {
      if (!owns()) return;
      if (initial) phase = 'error';
      else moreError = true; // Existing current-query results remain executable.
    } finally {
      if (owns()) {
        loadingMore = false;
        publish();
      }
    }
  };
  const search = async (value: string, composing = false) => {
    if (!alive) return;
    query = value;
    const current = ++revision;
    const owns = () => alive && revision === current;
    clear();
    // Invalidate older requests during composition without submitting partial IME.
    if (composing || !value.trim()) {
      phase = 'idle';
      publish();
      return;
    }
    phase = 'loading';
    publish();
    try {
      const api = await options.load();
      if (!owns()) return;
      const result = await api.search(value);
      if (!owns()) return;
      hits = result.results;
      if (!hits.length) {
        phase = 'empty';
        publish();
        return;
      }
      await loadPage(current, true);
    } catch {
      if (owns()) {
        phase = 'error';
        publish();
      }
    }
  };
  const prepare = async () => {
    if (!alive || query.trim()) return;
    const current = ++revision;
    clear();
    phase = 'loading';
    publish();
    try {
      await options.load();
      if (!alive || revision !== current) return;
      phase = 'idle';
    } catch {
      if (!alive || revision !== current) return;
      phase = 'error';
    }
    publish();
  };
  const loadMore = () =>
    phase === 'ready' && cursor < hits.length && !loadingMore
      ? loadPage(revision, false)
      : Promise.resolve();
  return {
    search,
    prepare,
    loadMore,
    /** Resolve against this live session, not a caller-retained stale snapshot. */
    resolveExecution(value: string): string | null {
      return alive && phase === 'ready'
        ? (rows.find((row) => row.id === value)?.href ?? null)
        : null;
    },
    retry: () => (moreError ? loadMore() : query.trim() ? search(query) : prepare()),
    cancel() {
      if (!alive) return;
      revision++;
      clear();
      phase = 'idle';
      publish();
    },
    dispose() {
      alive = false;
      revision++;
      clear();
    },
  };
}
