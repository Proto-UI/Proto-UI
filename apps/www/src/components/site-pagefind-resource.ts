import type { SitePagefindApi, SitePagefindHit } from './site-search-data';

/** Pagefind1.4 API, not @pagefind/default-ui. Owns bounded resource waiting only.
 * https://pagefind.app/docs/api/ — query results are lazy ranked document handles.
 * The page's HTML lang selects its index; locale navigation creates a new document.
 */
export function createSitePagefindResource(options: {
  bundleURL: string;
  origin: string;
  apiOptions?: Record<string, unknown>;
  importModule(url: string): Promise<unknown>;
  fetch?: typeof fetch;
  timeoutMs?: number;
}) {
  const bundle = new URL(options.bundleURL, options.origin);
  if (bundle.origin !== new URL(options.origin).origin || !/^https?:$/.test(bundle.protocol))
    throw new Error('Pagefind bundle must be same-origin');
  if (!bundle.pathname.endsWith('/')) bundle.pathname += '/';
  const timeoutMs = options.timeoutMs ?? 5000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('Invalid Pagefind timeout');
  let alive = true;
  let preparation: Promise<SitePagefindApi> | undefined;
  const pending = new Set<() => void>();
  const controllers = new Set<AbortController>();
  const bounded = <T>(operation: () => Promise<T>): Promise<T> =>
    new Promise((resolve, reject) => {
      if (!alive) {
        reject(new Error('Search disposed'));
        return;
      }
      let settled = false;
      const finish = (success: boolean, value: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        pending.delete(cancel);
        if (success) resolve(value as T);
        else reject(value);
      };
      const cancel = () => finish(false, new Error('Search disposed'));
      const timer = setTimeout(
        () => finish(false, new Error('Pagefind operation timed out')),
        timeoutMs
      );
      pending.add(cancel);
      // Both handlers remain attached after timeout/disposal: late rejection is
      // consumed, never a stale publication or unhandled-rejection workaround.
      Promise.resolve()
        .then(() => {
          if (!alive) throw new Error('Search disposed');
          return operation();
        })
        .then(
          (value) => finish(true, value),
          (error) => finish(false, error)
        );
    });
  const load = () => {
    if (!alive) return Promise.reject(new Error('Search disposed'));
    if (preparation) return preparation;
    const attempt = (async () => {
      const controller = new AbortController();
      controllers.add(controller);
      try {
        const response = await bounded(() =>
          (options.fetch ?? fetch)(new URL('pagefind.js', bundle), {
            method: 'HEAD',
            cache: 'no-store',
            signal: controller.signal,
          })
        );
        if (!response.ok) throw new Error('Pagefind index unavailable');
      } finally {
        controller.abort();
        controllers.delete(controller);
      }
      const imported = await bounded(() =>
        options.importModule(new URL('pagefind.js', bundle).href)
      );
      if (!alive) throw new Error('Search disposed');
      const api = imported as {
        search?: SitePagefindApi['search'];
        options?: (options: object) => Promise<void>;
      };
      if (typeof api?.search !== 'function' || typeof api.options !== 'function')
        throw new Error('Pagefind API is unavailable');
      await bounded(() => api.options!(options.apiOptions ?? {}));
      return {
        async search(query: string) {
          const result = await bounded(() => api.search!(query));
          if (!Array.isArray(result?.results)) throw new Error('Invalid Pagefind search result');
          return {
            results: result.results.map((hit): SitePagefindHit => {
              if (!hit || typeof hit.id !== 'string' || typeof hit.data !== 'function')
                throw new Error('Invalid Pagefind result handle');
              return { id: hit.id, data: () => bounded(() => hit.data()) };
            }),
          };
        },
      } satisfies SitePagefindApi;
    })();
    preparation = attempt;
    void attempt.catch(() => {
      if (preparation === attempt) preparation = undefined;
    });
    return attempt;
  };
  return {
    load,
    dispose() {
      if (!alive) return;
      alive = false;
      for (const controller of controllers) controller.abort();
      controllers.clear();
      for (const cancel of [...pending]) cancel();
      preparation = undefined;
    },
  };
}
