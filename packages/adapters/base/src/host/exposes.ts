import {
  isAppMakerExposeRecordEntry,
  isExposeStateExternalHandle,
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
  let lastWrapped: Record<string, unknown> = {};
  const externalHandleCache = new WeakMap<object, Record<string, unknown>>();
  const callableCache = new WeakMap<object, WeakMap<Function, (...args: unknown[]) => unknown>>();

  const wrapCallable = (
    value: (...args: unknown[]) => unknown,
    receiver: object
  ): ((...args: unknown[]) => unknown) => {
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
        result = Reflect.apply(value, receiver, args);
      });
      return result;
    };

    receiverCache.set(value, wrapped);
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

  const wrapValue = (value: unknown, receiver: object, seen: WeakMap<object, unknown>): unknown => {
    if (typeof value === 'function') {
      return wrapCallable(value as (...args: unknown[]) => unknown, receiver);
    }
    if (value === null || typeof value !== 'object') return value;

    const existing = seen.get(value);
    if (existing) return existing;

    if (isExposeStateExternalHandle(value)) {
      const cached = externalHandleCache.get(value);
      if (cached) {
        seen.set(value, cached);
        return cached;
      }

      const projected: Record<string, unknown> = {};
      externalHandleCache.set(value, projected);
      seen.set(value, projected);
      wrapEntries(value as unknown as Record<string, unknown>, projected, seen);
      return projected;
    }

    if (Array.isArray(value)) {
      const projected: unknown[] = new Array(value.length);
      seen.set(value, projected);
      wrapEntries(value as unknown as Record<string, unknown>, projected, seen);
      return projected;
    }

    if (!isPlainRecord(value)) return value;

    const projected = Object.create(Object.getPrototypeOf(value)) as Record<string, unknown>;
    seen.set(value, projected);
    wrapEntries(value, projected, seen);
    return projected;
  };

  function wrapEntries(
    source: Record<string, unknown>,
    target: Record<string, unknown> | unknown[],
    seen: WeakMap<object, unknown>
  ): void {
    for (const [key, value] of Object.entries(source)) {
      // Collection anatomy coordination remains available to internal PartView
      // consumers but is never part of the App Maker expose record.
      if (key.startsWith('__collection')) continue;
      if (!isAppMakerExposeRecordEntry(value)) continue;
      defineEntry(target, key, wrapValue(value, source, seen));
    }
  }

  const wrapRecord = (record: Record<string, unknown>): Record<string, unknown> => {
    const wrapped: Record<string, unknown> = {};
    const seen = new WeakMap<object, unknown>();
    seen.set(record, wrapped);
    wrapEntries(record, wrapped, seen);
    return wrapped;
  };

  return {
    read(record) {
      if (!live) return {};
      if (record !== lastRaw) {
        lastRaw = record;
        lastWrapped = wrapRecord(record);
      }
      return { ...lastWrapped };
    },
    invalidate() {
      if (!live) return;
      live = false;
      lastRaw = null;
      lastWrapped = {};
    },
  };
}
