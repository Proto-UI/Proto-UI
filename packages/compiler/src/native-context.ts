import { createHash } from 'node:crypto';
import type { PrototypeIR } from './ir';

const scopeFile = '.proto-ui/context/scope-v1.ts';

/** One reference module per source declaration; names are diagnostics, never identity. */
export function buildNativeContextArtifacts(ir: PrototypeIR): {
  files: readonly { path: string; contents: string; kind: 'source' }[];
  keys: ReadonlyMap<string, { name: string; file: string }>;
  scopeFile: string;
} {
  const keys = new Map(
    ir.contextKeys.map((key) => {
      const hash = createHash('sha256').update(key.id).digest('hex');
      return [
        key.id,
        { name: `__puiContextKey_${hash}`, file: `./.proto-ui/context/key-${hash}.ts` },
      ] as const;
    })
  );
  const files = ir.contextKeys.map((key) => ({
    path: keys.get(key.id)!.file.slice(2),
    kind: 'source' as const,
    contents: `// Source declaration ${JSON.stringify(key.id)}\n// Checked value schema ${JSON.stringify(key.type)}\nexport const key = Object.freeze({ debugName: ${JSON.stringify(key.name)} });\n`,
  }));
  files.push({ path: scopeFile, kind: 'source', contents: nativeContextScopeSource });
  return { files, keys, scopeFile: `./${scopeFile}` };
}

/** Delegates to the target's checked data predicate, preserving each key's exact shape. */
export function emitNativeContextValidation(
  ir: PrototypeIR,
  keyNames: ReadonlyMap<string, string>,
  acceptsName: string
): string {
  const checks = ir.contextKeys
    .map((key) => {
      const name = keyNames.get(key.id);
      if (!name) throw new Error(`Missing native Context key import: ${key.id}`);
      return `key === ${name} ? ${acceptsName}(${JSON.stringify(key.type)}, value) : `;
    })
    .join('');
  return `(key: object, value: unknown): boolean => ${checks}false`;
}

const nativeContextScopeSource = `// Shared native Context semantics v1. No Proto-UI Runtime/Core/Adapter dependency.
export type DataSchema = string | { kind: string; fields?: readonly { name: string; type: DataSchema; optional?: boolean }[]; element?: DataSchema; members?: readonly DataSchema[]; value?: unknown };
function isData(value: unknown, ancestors = new Set<object>()): boolean {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || ancestors.has(value)) return false;
  const array = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) return false;
  ancestors.add(value);
  try {
    if (array && Object.keys(value).length !== (value as unknown[]).length) return false;
    for (const key of Reflect.ownKeys(value)) {
      if (array && key === 'length') continue;
      if (typeof key !== 'string' || array && !/^(0|[1-9][0-9]*)$/.test(key)) return false;
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if (!descriptor.enumerable || !('value' in descriptor) || !isData(descriptor.value, ancestors)) return false;
    }
    return true;
  } finally { ancestors.delete(value); }
}
export function acceptsContextValue(type: DataSchema, value: unknown, checked = false): boolean {
  if (type === 'void') return value === undefined;
  if (!checked && value !== undefined && !isData(value)) return false;
  if (typeof type === 'string') {
    if (type === 'null') return value === null;
    return typeof value === type && (type !== 'number' || Number.isFinite(value));
  }
  switch (type.kind) {
    case 'literal': return Object.is(value, type.value);
    case 'union': return !!type.members?.some((member) => acceptsContextValue(member, value, true));
    case 'array': return Array.isArray(value) && !!type.element && Object.keys(value).length === value.length
      && value.every((item) => acceptsContextValue(type.element!, item, true));
    case 'record': return value !== null && typeof value === 'object' && !Array.isArray(value)
      && !!type.fields?.every((field) => !Object.hasOwn(value, field.name) ? !!field.optional
        : acceptsContextValue(field.type, (value as Record<string, unknown>)[field.name], true));
    default: return false;
  }
}
export type ContextScope = {
  provide<T>(key: object, value: T): void;
  subscribe<T>(key: object, mode: 'required' | 'optional', callback?: (next: T | null, prev: T | null) => void): () => void;
  read<T>(key: object): T;
  tryRead<T>(key: object): T | null;
  update<T>(key: object, next: T | ((prev: T) => T)): void;
  tryUpdate<T>(key: object, next: T | ((prev: T) => T)): boolean;
  dispose(): void;
};
export const scopeKey = Symbol('ProtoUI.ContextScope');
export const ownerScopes = new WeakMap<object, ContextScope>();
type Callback = { active: boolean; call(next: unknown, prev: unknown): void };
type RecordEntry = {
  scope: ContextScope;
  getParent(): ContextScope | null;
  isAlive(): boolean;
  invoke<T>(callback: () => T): T;
  validate(key: object, value: unknown): boolean;
  providers: Map<object, unknown>;
  subscriptions: Map<object, { mode: 'required' | 'optional'; callbacks: Callback[] }>;
};
const live = new Map<ContextScope, RecordEntry>();
const notifications: { record: RecordEntry; callback: Callback; next: unknown; prev: unknown }[] = [];
let dispatching = false;
function resolve(record: RecordEntry, key: object): RecordEntry | null {
  let current: RecordEntry | undefined = record;
  const visited = new Set<ContextScope>();
  while (current) {
    if (visited.has(current.scope)) throw new Error('[Context] cyclic logical scope ancestry.');
    visited.add(current.scope);
    if (!current.isAlive()) return null;
    if (current.providers.has(key)) return current;
    const parent = current.getParent();
    current = parent === null ? undefined : live.get(parent);
  }
  return null;
}
export function createContextScope(options: {
  getParent(): ContextScope | null;
  isAlive(): boolean;
  invoke<T>(callback: () => T): T;
  validate(key: object, value: unknown): boolean;
}): ContextScope {
  let disposed = false;
  let record: RecordEntry;
  function ensureAlive() {
    if (disposed || !options.isAlive()) throw new Error('[Context] scope is invalid after terminal disposal.');
  }
  function subscribed(key: object, mode?: 'required' | 'optional') {
    const subscription = record.subscriptions.get(key);
    if (!subscription || mode && subscription.mode !== mode)
      throw new Error('[Context] operation requires a declared ' + (mode ?? '') + ' subscription.');
    return subscription;
  }
  function provider(key: object): RecordEntry {
    const bound = resolve(record, key);
    if (!bound) throw new Error('[Context] provider missing or disconnected.');
    return bound;
  }
  function write<T>(key: object, next: T | ((prev: T) => T), bound: RecordEntry) {
    const prev = bound.providers.get(key);
    const value = typeof next === 'function' ? (next as (prev: T) => T)(prev as T) : next;
    ensureAlive();
    if (!live.has(bound.scope) || !bound.isAlive()) throw new Error('[Context] provider disconnected during update.');
    if (!options.validate(key, value)) throw new TypeError('[Context] invalid checked Context value.');
    bound.providers.set(key, value);
    // Snapshot each transition before dispatch; nested writes append, never overwrite next/prev.
    for (const participant of live.values()) {
      const subscription = participant.subscriptions.get(key);
      if (!subscription || !participant.isAlive() || resolve(participant, key) !== bound) continue;
      for (const callback of subscription.callbacks) if (callback.active)
        notifications.push({ record: participant, callback, next: value, prev });
    }
    if (dispatching) return;
    dispatching = true;
    let failure: unknown;
    try {
      for (let index = 0; index < notifications.length; ++index) {
        const task = notifications[index];
        if (!task.callback.active || !live.has(task.record.scope) || !task.record.isAlive()) continue;
        try { task.record.invoke(() => task.callback.call(task.next, task.prev)); }
        catch (error) { failure ??= error; }
      }
    } finally { notifications.length = 0; dispatching = false; }
    if (failure !== undefined) throw failure;
  }
  const scope: ContextScope = {
    provide(key, value) {
      ensureAlive();
      if (record.providers.has(key)) throw new Error('[Context] duplicate provide.');
      if (!options.validate(key, value)) throw new TypeError('[Context] invalid checked Context value.');
      record.providers.set(key, value);
    },
    subscribe<T>(key: object, mode: 'required' | 'optional', callback?: (next: T | null, prev: T | null) => void) {
      ensureAlive();
      if (mode !== 'required' && mode !== 'optional') throw new Error('[Context] invalid subscription mode.');
      if (mode === 'required') provider(key);
      let subscription = record.subscriptions.get(key);
      if (subscription && subscription.mode !== mode) throw new Error('[Context] subscription mode mismatch.');
      if (!subscription) {
        subscription = { mode, callbacks: [] };
        record.subscriptions.set(key, subscription);
      }
      const entry: Callback | undefined = callback ? { active: true, call: (next, prev) => callback(next as T, prev as T) } : undefined;
      if (entry) subscription.callbacks.push(entry);
      return () => { if (entry) entry.active = false; };
    },
    read<T>(key: object): T { ensureAlive(); subscribed(key, 'required'); return provider(key).providers.get(key) as T; },
    tryRead<T>(key: object): T | null { ensureAlive(); subscribed(key, 'optional'); return resolve(record, key)?.providers.get(key) as T ?? null; },
    update(key, next) {
      ensureAlive();
      if (!record.providers.has(key)) subscribed(key);
      write(key, next, provider(key));
    },
    tryUpdate(key, next) {
      ensureAlive(); subscribed(key, 'optional');
      const bound = resolve(record, key);
      if (!bound) return false;
      write(key, next, bound);
      return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      live.delete(scope);
      record.providers.clear();
      for (const subscription of record.subscriptions.values()) {
        for (const callback of subscription.callbacks) callback.active = false;
        subscription.callbacks.length = 0;
      }
      record.subscriptions.clear();
    },
  };
  record = { ...options, scope, providers: new Map(), subscriptions: new Map() };
  live.set(scope, record);
  return Object.freeze(scope);
}
`;
