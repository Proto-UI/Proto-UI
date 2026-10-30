import {
  createSiteSearchData,
  type SitePagefindApi,
  type SiteSearchSnapshot,
} from './site-search-data';

/** Website data/session owner; Dialog and Command retain all interaction semantics. */
export function createSiteSearchSession(options: {
  load(): Promise<SitePagefindApi>;
  origin: string;
  navigate(href: string): void;
  formatURL?(path: string): string;
}) {
  let alive = true;
  let open = false;
  let retrying = false;
  let retryEpoch = 0;
  let snapshot: SiteSearchSnapshot = {
    query: '',
    phase: 'idle',
    rows: [],
    resultCount: 0,
    hasMore: false,
    loadingMore: false,
    moreError: false,
  };
  const listeners = new Set<() => void>();
  const publish = () => {
    if (alive) for (const listener of listeners) listener();
  };
  const data = createSiteSearchData({
    ...options,
    publish(next) {
      snapshot = next;
      publish();
    },
  });
  const setOpen = (next: boolean) => {
    if (!alive || next === open) return;
    open = next;
    if (!next) {
      retryEpoch++;
      retrying = false;
      data.cancel();
    } else if (snapshot.query.trim()) void data.search(snapshot.query);
    else void data.prepare();
    publish();
  };
  return {
    read: () => ({ open, snapshot, retrying }),
    subscribe(listener: () => void) {
      if (!alive) return () => {};
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setOpen,
    input(value: string, composing: boolean) {
      if (alive && open) {
        retryEpoch++;
        retrying = false;
        void data.search(value, composing);
      }
    },
    execute(value: string) {
      if (!alive || !open) return false;
      const href = data.resolveExecution(value);
      if (!href) return false;
      setOpen(false);
      options.navigate(href);
      return true;
    },
    retry() {
      if (!alive || !open || retrying) return;
      const epoch = ++retryEpoch;
      retrying = true;
      publish();
      void data.retry().finally(() => {
        if (!alive || epoch !== retryEpoch) return;
        retrying = false;
        publish();
      });
    },
    loadMore() {
      if (alive && open) void data.loadMore();
    },
    dispose() {
      if (!alive) return;
      alive = false;
      retryEpoch++;
      retrying = false;
      open = false;
      data.dispose();
      listeners.clear();
    },
  };
}
export type SiteSearchSession = ReturnType<typeof createSiteSearchSession>;
