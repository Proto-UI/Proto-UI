import { createHash } from 'node:crypto';
import type { PrototypeIR } from './ir';

const scopeFile = '.proto-ui/qt/context/QtContextScope.mjs';

/**
 * Qt Quick native Context semantics. Mirrors the shared native Context contract but emits
 * as ordinary QML/JS source consumed by Qt's QML engine, not a DOM WeakMap. One reference
 * module per source declaration; names are diagnostics, never identity.
 */
export function buildQtContextArtifacts(ir: PrototypeIR): {
  files: readonly { path: string; contents: string; kind: 'source' }[];
  keys: ReadonlyMap<string, { name: string; file: string }>;
  scopeFile: string;
} {
  const keys = new Map(ir.contextKeys.map((key) => {
    const hash = createHash('sha256').update(key.id).digest('hex');
    return [key.id, { name: `__puiQtContextKey_${hash}`, file: `./.proto-ui/qt/context/key-${hash}.mjs` }] as const;
  }));
  const files = ir.contextKeys.map((key) => ({
    path: keys.get(key.id)!.file.slice(2), kind: 'source' as const,
    contents: `// Source declaration ${JSON.stringify(key.id)}\n// Checked value schema ${JSON.stringify(key.type)}\nexport const key = Object.freeze({ debugName: ${JSON.stringify(key.name)} });\n`,
  }));
  files.push({ path: scopeFile, kind: 'source', contents: qtContextScopeSource });
  return { files, keys, scopeFile: `./${scopeFile}` };
}

/** Delegates to the target's checked data predicate, preserving each key's exact shape. */
export function emitQtContextValidation(
  ir: PrototypeIR,
  keyNames: ReadonlyMap<string, string>,
  acceptsName: string
): string {
  const checks = ir.contextKeys.map((key) => {
    const name = keyNames.get(key.id);
    if (!name) throw new Error(`Missing Qt Context key import: ${key.id}`);
    return `key === ${name} ? ${acceptsName}(${JSON.stringify(key.type)}, value) : `;
  }).join('');
  return `(key, value) => ${checks}false`;
}

const qtContextScopeSource = `// Qt Quick native Context semantics. No Proto Runtime/Core/Adapter dependency.
// Ordinary QML/JS consumed by Qt's QML engine. Logical scope ancestry follows registered
// generated owners through QObject parents and supported reparenting, never QML item names.
export function isData(value, ancestors = new Set()) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || ancestors.has(value)) return false;
  const array = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) return false;
  ancestors.add(value);
  try {
    if (array && Object.keys(value).length !== value.length) return false;
    for (const key of Reflect.ownKeys(value)) {
      if (array && key === 'length') continue;
      if (typeof key !== 'string' || array && !/^(0|[1-9][0-9]*)$/.test(key)) return false;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor.enumerable || !('value' in descriptor) || !isData(descriptor.value, ancestors)) return false;
    }
    return true;
  } finally { ancestors.delete(value); }
}
export function acceptsContextValue(type, value, checked = false) {
  if (type === 'void') return value === undefined;
  if (!checked && value !== undefined && !isData(value)) return false;
  if (typeof type === 'string') {
    if (type === 'null') return value === null;
    return typeof value === type && (type !== 'number' || Number.isFinite(value));
  }
  switch (type.kind) {
    case 'literal': return Object.is(value, type.value);
    case 'union': return !!type.members && type.members.some((member) => acceptsContextValue(member, value, true));
    case 'array': return Array.isArray(value) && !!type.element && Object.keys(value).length === value.length
      && value.every((item) => acceptsContextValue(type.element, item, true));
    case 'record': return value !== null && typeof value === 'object' && !Array.isArray(value)
      && !!type.fields && type.fields.every((field) => !Object.prototype.hasOwnProperty.call(value, field.name) ? !!field.optional
        : acceptsContextValue(field.type, value[field.name], true));
    default: return false;
  }
}
// Each Context scope is a plain JS record registered by owner identity. QML object parents
// replace DOM parentNode traversal; supported reparenting preserves the logical chain.
const liveScopes = new Map();
const ownerScopes = new Map();
const notifications = [];
let dispatching = false;
function resolveRecord(record, key) {
  let current = record;
  const visited = new Set();
  while (current) {
    if (visited.has(current.scope)) throw new Error('[QtContext] cyclic logical scope ancestry.');
    visited.add(current.scope);
    if (!current.isAlive()) return null;
    if (current.providers.has(key)) return current;
    const parent = current.getParent();
    current = parent === null ? undefined : liveScopes.get(parent);
  }
  return null;
}
export function createContextScope(options) {
  let disposed = false;
  const scope = { __puiQtContextScope: true };
  const record = {
    scope, getParent: options.getParent, isAlive: options.isAlive,
    invoke: options.invoke, validate: options.validate,
    providers: new Map(), subscriptions: new Map(),
  };
  function ensureAlive() {
    if (disposed || !options.isAlive()) throw new Error('[QtContext] scope is invalid after terminal disposal.');
  }
  function subscribed(key, mode) {
    const subscription = record.subscriptions.get(key);
    if (!subscription || mode && subscription.mode !== mode)
      throw new Error('[QtContext] operation requires a declared ' + (mode || '') + ' subscription.');
    return subscription;
  }
  function provider(key) {
    const bound = resolveRecord(record, key);
    if (!bound) throw new Error('[QtContext] provider missing or disconnected.');
    return bound;
  }
  function write(key, next, bound) {
    const prev = bound.providers.get(key);
    const value = typeof next === 'function' ? next(prev) : next;
    ensureAlive();
    if (!liveScopes.has(bound.scope) || !bound.isAlive()) throw new Error('[QtContext] provider disconnected during update.');
    if (!options.validate(key, value)) throw new TypeError('[QtContext] invalid checked Context value.');
    bound.providers.set(key, value);
    for (const participant of liveScopes.values()) {
      const subscription = participant.subscriptions.get(key);
      if (!subscription || !participant.isAlive() || resolveRecord(participant, key) !== bound) continue;
      subscription.bound=bound;subscription.value=value;
      for (const callback of subscription.callbacks) if (callback.active)
        notifications.push({ record: participant, callback, next: value, prev });
    }
    if (dispatching) return;
    dispatching = true;
    let failure;
    try {
      for (let index = 0; index < notifications.length; ++index) {
        const task = notifications[index];
        if (!task.callback.active || !liveScopes.has(task.record.scope) || !task.record.isAlive()) continue;
        try { task.record.invoke(() => task.callback.call(task.next, task.prev)); }
        catch (error) { if (failure === undefined) failure = error; }
      }
    } finally { notifications.length = 0; dispatching = false; }
    if (failure !== undefined) throw failure;
  }
  const api = {
    provide(key, value) {
      ensureAlive();
      if (record.providers.has(key)) throw new Error('[QtContext] duplicate provide.');
      if (!options.validate(key, value)) throw new TypeError('[QtContext] invalid checked Context value.');
      record.providers.set(key, value);
    },
    subscribe(key, mode, callback) {
      ensureAlive();
      if (mode !== 'required' && mode !== 'optional') throw new Error('[QtContext] invalid subscription mode.');
      if (mode === 'required') provider(key);
      let subscription = record.subscriptions.get(key);
      if (subscription && subscription.mode !== mode) throw new Error('[QtContext] subscription mode mismatch.');
      if (!subscription) { const bound=resolveRecord(record,key);subscription = { mode, callbacks: [], bound, value:bound?bound.providers.get(key):null }; record.subscriptions.set(key, subscription); }
      const entry = callback ? { active: true, call: (next, prev) => callback(next, prev) } : undefined;
      if (entry) subscription.callbacks.push(entry);
      return () => { if (entry) entry.active = false; };
    },
    read(key) { ensureAlive(); subscribed(key, 'required'); return provider(key).providers.get(key); },
    tryRead(key) { ensureAlive(); subscribed(key, 'optional'); const bound = resolveRecord(record, key); return bound ? bound.providers.get(key) : null; },
    update(key, next) { ensureAlive(); if (!record.providers.has(key)) subscribed(key); write(key, next, provider(key)); },
    tryUpdate(key, next) { ensureAlive(); subscribed(key, 'optional'); const bound = resolveRecord(record, key); if (!bound) return false; write(key, next, bound); return true; },
    rebind() {
      ensureAlive();
      for(const [key,subscription] of record.subscriptions) {
        const bound=resolveRecord(record,key);
        if(bound===subscription.bound)continue;
        if(!bound&&subscription.mode==='required')continue;
        const previous=subscription.value,next=bound?bound.providers.get(key):null;
        subscription.bound=bound;subscription.value=next;
        for(const callback of subscription.callbacks)if(callback.active)record.invoke(()=>callback.call(next,previous));
      }
    },
    dispose() {
      if (disposed) return; disposed = true;
      liveScopes.delete(scope);
      record.providers.clear();
      for (const subscription of record.subscriptions.values()) { subscription.callbacks.length = 0; }
      record.subscriptions.clear();
    },
  };
  record.scopeApi = api;
  liveScopes.set(scope, record);
  return Object.freeze({ scope, api });
}
export function registerOwnerScope(ownerObject, scope) { ownerScopes.set(ownerObject, scope); }
export function unregisterOwnerScope(ownerObject) { ownerScopes.delete(ownerObject); }
export function contextParent(ownerObject, getParent) {
  if (!ownerObject) return null;
  let node = getParent ? getParent(ownerObject) : null;
  while (node) {
    const scope = ownerScopes.get(node);
    if (scope) return scope;
    node = getParent ? getParent(node) : null;
  }
  return null;
}
`;
