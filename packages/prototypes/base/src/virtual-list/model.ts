export type WindowRange = Readonly<{ start: number; end: number }>;
export type WindowRequest = WindowRange &
  Readonly<{ generation: number; revision: number; keys: readonly string[] }>;
export type WindowSnapshot = Readonly<{
  keys: readonly string[];
  revision: number;
  generation: number;
  status: 'idle' | 'requesting' | 'committed' | 'unavailable';
  requested: WindowRange | null;
  committed: WindowRange | null;
  materializedKeys: readonly string[];
}>;
export interface WindowedCollection {
  setItems(keys: readonly string[]): void;
  configure(policy: { overscanItems?: number; maxMaterializedItems?: number }): void;
  propose(start: number, end: number): WindowRequest | null;
  commit(request: WindowRequest, keys: readonly string[]): boolean;
  reject(request: WindowRequest): void;
  invalidate(): void;
  snapshot(): WindowSnapshot;
  subscribe(listener: () => void): () => void;
}
/** Complete logical identity is independent of physical Anatomy membership. No host units enter this model. */
export function createWindowedCollection(
  policy: { overscanItems?: number; maxMaterializedItems?: number } = {}
): WindowedCollection {
  let keys: string[] = [],
    revision = 0,
    generation = 0,
    overscan = 2,
    limit = 100;
  let status: WindowSnapshot['status'] = 'idle',
    requested: WindowRange | null = null,
    committed: WindowRange | null = null,
    materializedKeys: string[] = [];
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const fn of [...listeners]) fn();
  };
  let initialized = false;
  const configure = (next: typeof policy) => {
    const o = next.overscanItems ?? overscan,
      l = next.maxMaterializedItems ?? limit;
    if (!Number.isSafeInteger(o) || o < 0 || !Number.isSafeInteger(l) || l < 1 || l > 10000)
      throw new Error('Window policy requires bounded item counts');
    const changed = o !== overscan || l !== limit;
    overscan = o;
    limit = l;
    if (initialized && changed) {
      generation++;
      requested = null;
      committed = null;
      materializedKeys = [];
      status = 'idle';
      notify();
    }
  };
  configure(policy);
  initialized = true;
  const snapshot = (): WindowSnapshot => ({
    keys: [...keys],
    revision,
    generation,
    status,
    requested: requested && { ...requested },
    committed: committed && { ...committed },
    materializedKeys: [...materializedKeys],
  });
  const invalidate = () => {
    generation++;
    requested = null;
    committed = null;
    materializedKeys = [];
    status = 'idle';
    notify();
  };
  return {
    configure,
    snapshot,
    invalidate,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    setItems(next) {
      if (next.some((k) => typeof k !== 'string' || !k) || new Set(next).size !== next.length)
        throw new Error('Windowed Collection requires unique stable non-empty keys');
      if (next.length === keys.length && next.every((k, i) => k === keys[i])) return;
      keys = [...next];
      revision++;
      invalidate();
    },
    propose(start, end) {
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start < 0 ||
        end < start ||
        end > keys.length
      ) {
        status = 'unavailable';
        return null;
      }
      const visible = end - start;
      if (visible > limit) {
        status = 'unavailable';
        return null;
      }
      let from = Math.max(0, start - overscan),
        to = Math.min(keys.length, end + overscan);
      if (to - from > limit) {
        from = Math.max(0, start - Math.floor((limit - visible) / 2));
        to = Math.min(keys.length, from + limit);
      }
      requested = { start: from, end: to };
      status = 'requesting';
      generation++;
      return { ...requested, generation, revision, keys: Object.freeze(keys.slice(from, to)) };
    },
    commit(request, actual) {
      if (
        request.generation !== generation ||
        !requested ||
        request.start !== requested.start ||
        request.end !== requested.end ||
        request.keys.length !== request.end - request.start ||
        request.keys.some((key, i) => key !== keys[request.start + i]) ||
        request.revision !== revision ||
        status !== 'requesting' ||
        actual.length !== request.keys.length ||
        actual.some((key, i) => key !== request.keys[i])
      )
        return false;
      committed = { start: request.start, end: request.end };
      materializedKeys = [...actual];
      status = 'committed';
      return true;
    },
    reject(request) {
      if (
        request.generation !== generation ||
        !requested ||
        request.start !== requested.start ||
        request.end !== requested.end ||
        request.keys.length !== request.end - request.start ||
        request.keys.some((key, i) => key !== keys[request.start + i]) ||
        request.revision !== revision
      )
        return;
      status = 'unavailable';
      committed = null;
      materializedKeys = [];
    },
  };
}
