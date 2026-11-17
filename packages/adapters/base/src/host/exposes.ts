import {
  isAppMakerExposeRecordEntry,
  isExposeStateExternalHandle,
  isExposeStateSubscriptionCancellation,
} from '@proto.ui/module-expose-state';

export type CallbackScopeInvoker = (fn: () => void) => void;

export interface ScopedExposesReader {
  read(record: Record<string, unknown>): Record<string, unknown>;
  invalidate(): void;
}

const TERMINAL_EXPOSE_CALL_ERROR =
  '[AdapterHost] cannot invoke an exposed callable after terminal disposal';
const MISSING_CALLBACK_SCOPE_ERROR =
  '[AdapterHost] cannot invoke an exposed callable without a live callback scope';

function isPlainRecord(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Keeps an adapter expose snapshot stable while ensuring every outward method
 * enters the owning Proto instance's callback scope before it runs.
 */
export function createScopedExposesReader(
  getInvoker: () => CallbackScopeInvoker | null | undefined
): ScopedExposesReader {
  let live = true;
  let lastRaw: Record<string, unknown> | null = null;
  // The top-level record is a replacement snapshot of one instance registry.
  const rootReceiver = {};
  const callableCache = new WeakMap<object, WeakMap<Function, (...args: unknown[]) => unknown>>();
  const recordCache = new WeakMap<object, object>();
  const projectedCallables = new WeakSet<Function>();

  const wrapCallable = (
    value: (...args: unknown[]) => unknown,
    receiver: object,
    currentReceiver: () => object = () => receiver
  ): ((...args: unknown[]) => unknown) => {
    // Cancelling an issued State subscription revokes a resource without entering
    // its retired owner. Authored callbacks and ordinary return values stay scoped.
    if (isExposeStateSubscriptionCancellation(value)) return value;
    if (projectedCallables.has(value)) return value;
    let receiverCache = callableCache.get(receiver);
    if (!receiverCache) {
      receiverCache = new WeakMap();
      callableCache.set(receiver, receiverCache);
    }

    const cached = receiverCache.get(value);
    if (cached) return cached;

    const wrapped = (...args: unknown[]) => {
      if (!live) throw new Error(TERMINAL_EXPOSE_CALL_ERROR);

      const invoke = getInvoker();
      if (!invoke) throw new Error(MISSING_CALLBACK_SCOPE_ERROR);

      let result: unknown;
      invoke(() => {
        result = projectValue(Reflect.apply(value, currentReceiver(), args));
      });
      return result;
    };

    receiverCache.set(value, wrapped);
    projectedCallables.add(wrapped);
    return wrapped;
  };

  const defineEntry = (target: object, key: string, value: unknown) => {
    Object.defineProperty(target, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  };

  function projectValue(value: unknown, registry = false): unknown {
    if (typeof value === 'function')
      return wrapCallable(
        value as (...args: unknown[]) => unknown,
        rootReceiver,
        () => lastRaw ?? rootReceiver
      );
    if (value === null || typeof value !== 'object') return value;

    type RecordNode = {
      source: object;
      entries: [string, unknown][];
      parents: Set<RecordNode>;
      project: boolean;
      target?: object;
    };
    const graph = new WeakMap<object, RecordNode>();
    const nodes: RecordNode[] = [];
    const inspect = (source: object): RecordNode | undefined => {
      const existing = graph.get(source);
      if (existing) return existing;
      if (!Array.isArray(source) && !isPlainRecord(source) && !isExposeStateExternalHandle(source))
        return undefined;
      const node: RecordNode = {
        source,
        entries: [],
        parents: new Set(),
        project: recordCache.has(source),
      };
      graph.set(source, node);
      nodes.push(node);
      // Read each entry once. Projection discovery must not evaluate accessors
      // again when deciding which records need a callable boundary.
      for (const [key, entry] of Object.entries(source)) {
        if (key.startsWith('__collection') || !isAppMakerExposeRecordEntry(entry)) {
          node.project = true;
          continue;
        }
        node.entries.push([key, entry]);
        if (typeof entry === 'function') node.project = true;
        else if (entry !== null && typeof entry === 'object') inspect(entry)?.parents.add(node);
      }
      return node;
    };
    const root = inspect(value);
    if (!root) return value;
    root.project ||= registry;

    // Propagate through cycles before allocating. A data-only graph retains its
    // original identity, including nominal ContextKey and presentation tokens.
    const pending = nodes.filter((node) => node.project);
    while (pending.length) {
      for (const parent of pending.pop()!.parents) {
        if (parent.project) continue;
        parent.project = true;
        pending.push(parent);
      }
    }
    for (const node of nodes) {
      if (!node.project) continue;
      node.target = recordCache.get(node.source);
      if (!node.target) {
        node.target = Array.isArray(node.source)
          ? []
          : Object.create(Object.getPrototypeOf(node.source));
        recordCache.set(node.source, node.target!);
        // A public record can return with newly assigned functions. Scan its
        // current contents again while preserving the same projection object.
        recordCache.set(node.target!, node.target!);
      }
    }
    for (const node of nodes) {
      if (!node.target) continue;
      // Refresh on an explicit read or result boundary; this is not a reactive
      // value channel. Held projections keep identity and observe that refresh.
      for (const key of Object.keys(node.target)) Reflect.deleteProperty(node.target, key);
      if (Array.isArray(node.target) && Array.isArray(node.source))
        node.target.length = node.source.length;
      for (const [key, entry] of node.entries) {
        const projected =
          typeof entry === 'function'
            ? registry && node === root
              ? wrapCallable(
                  entry as (...args: unknown[]) => unknown,
                  rootReceiver,
                  () => lastRaw ?? rootReceiver
                )
              : wrapCallable(entry as (...args: unknown[]) => unknown, node.source)
            : entry !== null && typeof entry === 'object'
              ? (graph.get(entry)?.target ?? entry)
              : entry;
        defineEntry(node.target, key, projected);
      }
    }
    return root.target ?? value;
  }

  return {
    read(record) {
      if (!live) return {};
      lastRaw = record;
      return { ...(projectValue(record, true) as Record<string, unknown>) };
    },
    invalidate() {
      if (!live) return;
      live = false;
      lastRaw = null;
    },
  };
}
