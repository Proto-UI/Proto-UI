// packages/runtime/src/kernel/as-hook.ts
import type {
  AsHookInstanceState,
  AsHookChildResult,
  AsHookMode,
  AsHookRuntime,
  AsHookResult,
  AsHookTraceEntry,
  BorrowedStateHandle,
  DefHandle,
  RenderFn,
  RunHandle,
} from '@proto.ui/core';
import { bindAsHookRuntime } from '@proto.ui/core/internal';
import type { PropsBaseType } from '@proto.ui/types';
import type { StatePort } from '@proto.ui/module-state';
import { illegalPhase } from './guard';

const TRACE_INTERNAL = Symbol.for('@proto.ui/asHook/trace-internal');

type TraceStore = {
  entries: AsHookTraceEntry[];
  nameSet: Set<string>;
};

type DefRuntimeState = {
  getPhase(): 'setup' | 'render' | 'callback' | 'unknown';
  prototypeName: string;
};

type AsHookMeta = { privileged: boolean; mode?: AsHookMode };
type EffectKind = 'props' | 'state' | 'context' | 'event' | 'feedback';
type StateNameEntry = { stateId?: unknown };
type EffectFrame = {
  name: string;
  order: number;
  privileged: boolean;
  mode?: AsHookMode;
  effects: Record<EffectKind, unknown[]>;
  asHooks: AsHookChildResult[];
  stateNames: Map<string, StateNameEntry>;
};

type StateHandleLike = {
  get: () => unknown;
  setDefault?: (v: unknown) => void;
  set?: (v: unknown, reason?: unknown) => void;
  __stateId?: unknown;
  __stateName?: unknown;
  __stateSemantic?: unknown;
  __stateKind?: unknown;
  __stateSpec?: unknown;
};

function isStateHandleLike(x: any): x is StateHandleLike {
  return !!x && typeof x === 'object' && typeof x.get === 'function' && !!x.__stateId;
}

function collectNamedStateHandles(entries: unknown[]): Record<string, StateHandleLike> | undefined {
  const named = new Map<string, StateHandleLike>();
  const seenIds = new Set<unknown>();

  for (const entry of entries) {
    const handle =
      (entry as any)?.op === 'expose.state' || (entry as any)?.op === 'a11y.state'
        ? (entry as any).handle
        : entry;
    if (!isStateHandleLike(handle)) continue;

    const name = handle.__stateName;
    if (typeof name !== 'string' || !name) continue;

    const id = handle.__stateId ?? name;
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    named.set(name, handle);
  }

  if (named.size === 0) return undefined;
  return Object.fromEntries(named);
}

function collectDisposers(
  entries: unknown[],
  predicate?: (entry: unknown) => boolean
): Array<() => void> {
  const out: Array<() => void> = [];
  for (const entry of entries) {
    if (predicate && !predicate(entry)) continue;
    if (typeof entry === 'function') {
      out.push(entry as () => void);
      continue;
    }
    const off = (entry as any)?.off;
    if (typeof off === 'function') out.push(off);
  }
  return out;
}

function wrapSetupOnlyDisposer(
  disposer: () => void,
  ensureSetup: (op: string) => void
): () => void {
  return () => {
    ensureSetup('asHook.disposer');
    disposer();
  };
}

function collectEventKeys(entries: unknown[]): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const entry of entries) {
    if ((entry as any)?.op !== 'expose.event') continue;
    const key = (entry as any)?.key;
    if (typeof key !== 'string' || !key) continue;
    out[key] = key;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function collectExposeMethods(entries: unknown[]): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  for (const entry of entries) {
    if ((entry as any)?.op !== 'expose.method') continue;
    const key = (entry as any)?.key;
    if (typeof key !== 'string' || !key) continue;
    out[key] = (entry as any)?.fn;
  }
  return Object.keys(out).length > 0 ? Object.freeze(out) : undefined;
}

function getOrCreateTrace(proto: object): TraceStore {
  const anyProto = proto as any;
  if (!anyProto[TRACE_INTERNAL]) {
    const store: TraceStore = { entries: [], nameSet: new Set() };
    Object.defineProperty(anyProto, TRACE_INTERNAL, {
      value: store,
      enumerable: false,
      configurable: false,
      writable: false,
    });

    Object.defineProperty(anyProto, '__asHooks', {
      get: () => Object.freeze(store.entries.slice()),
      enumerable: false,
      configurable: false,
    });
  }

  return (
    (anyProto[TRACE_INTERNAL] as TraceStore) ?? {
      entries: [],
      nameSet: new Set(),
    }
  );
}

function createBorrowedHandle<P extends PropsBaseType, V>(
  port: StatePort,
  handle: StateHandleLike
): BorrowedStateHandle<V, P> {
  const raw = port.createBorrowedHandle(handle as any);

  const borrowed: BorrowedStateHandle<V, P> = {
    get: () => raw.get() as V,
    setDefault: (v: V) => raw.setDefault(v),
    set: (v: V, reason?: unknown) => raw.set(v, reason),
    watch: (cb) => raw.watch((ctx, e) => cb(ctx as RunHandle<P>, e as any)),
  };

  (borrowed as any).__stateId = (handle as any).__stateId;
  (borrowed as any).__stateName = (handle as any).__stateName;
  (borrowed as any).__stateSemantic = (handle as any).__stateSemantic;
  (borrowed as any).__stateKind = (handle as any).__stateKind;
  (borrowed as any).__stateSpec = (handle as any).__stateSpec;

  return borrowed;
}

function projectStateValue<P extends PropsBaseType>(port: StatePort, value: any): any {
  if (isStateHandleLike(value)) {
    return createBorrowedHandle<P, any>(port, value);
  }
  if (Array.isArray(value)) {
    let changed = false;
    const mapped = value.map((v) => {
      const next = projectStateValue<P>(port, v);
      if (next !== v) changed = true;
      return next;
    });
    return changed ? mapped : value;
  }
  if (value && typeof value === 'object') {
    let changed = false;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const next = projectStateValue<P>(port, v);
      if (next !== v) changed = true;
      out[k] = next;
    }
    return changed ? out : value;
  }
  return value;
}

export function createAsHookStateProjector<P extends PropsBaseType>(
  port?: StatePort
): <T>(state: T) => T {
  if (!port) return (state) => state;
  return <T>(state: T) => projectStateValue<P>(port, state) as T;
}

export function attachAsHookRuntime<P extends PropsBaseType>(
  def: DefHandle<P, any>,
  st: DefRuntimeState,
  proto: object,
  opt?: { projectState?: <T>(state: T) => T }
): AsHookRuntime {
  const trace = getOrCreateTrace(proto);
  const instances = new Map<
    string,
    { order: number; state: AsHookInstanceState; mode: AsHookMode }
  >();
  const registrationKinds = new Map<string, boolean>();
  const frameStack: EffectFrame[] = [];
  const rootStateNames = new Map<string, StateNameEntry>();
  let instanceOrder = 0;
  const projectState = opt?.projectState ?? ((state: any) => state);

  const createFrame = (
    name: string,
    meta: { order: number; privileged: boolean; mode?: AsHookMode }
  ): EffectFrame => ({
    name,
    order: meta.order,
    privileged: meta.privileged,
    mode: meta.mode,
    asHooks: [],
    stateNames: new Map(),
    effects: {
      props: [],
      state: [],
      context: [],
      event: [],
      feedback: [],
    },
  });

  const compact = (values: unknown[]): unknown => {
    if (values.length === 0) return undefined;
    if (values.length === 1) return values[0];
    return values.slice();
  };

  const ensureSetup = (op: string) => {
    const phase = st.getPhase();
    if (phase !== 'setup') {
      illegalPhase(op, st.prototypeName, phase, `Use 'asHook' in setup only.`);
    }
  };

  const validateStateName = (name: string): void => {
    if (typeof name !== 'string' || name.length === 0) {
      throw new Error(`[State] state name must be a non-empty string.`);
    }
  };

  const registerStateNameIn = (
    names: Map<string, StateNameEntry>,
    name: string,
    stateId?: unknown
  ): void => {
    validateStateName(name);
    const existing = names.get(name);
    if (!existing) {
      names.set(name, { stateId });
      return;
    }
    if (
      typeof existing.stateId !== 'undefined' &&
      typeof stateId !== 'undefined' &&
      Object.is(existing.stateId, stateId)
    ) {
      return;
    }
    throw new Error(`[State] duplicate state name in setup frame: ${name}`);
  };

  const runtime: AsHookRuntime = {
    ensureSetup,
    register: (name: string, meta: AsHookMeta) => {
      const privileged = !!meta.privileged;
      if (registrationKinds.has(name) && registrationKinds.get(name) !== privileged) {
        throw new Error(
          `[AsHook] ${name}: privileged and authored hooks cannot share a registration name.`
        );
      }
      registrationKinds.set(name, privileged);
      const mode = meta.mode ?? 'once';
      const existing = instances.get(name);

      if (mode === 'multiple') {
        const order = instanceOrder++;
        const state: AsHookInstanceState = { store: {} };
        if (!trace.nameSet.has(name)) {
          const entry: AsHookTraceEntry = {
            name,
            order,
            privileged: !!meta.privileged,
            mode,
          };
          trace.nameSet.add(name);
          trace.entries.push(entry);
        }
        return { action: 'setup' as const, order, state };
      }

      if (!existing) {
        const order = instanceOrder++;
        const state: AsHookInstanceState = { store: {} };
        instances.set(name, { order, state, mode });
        if (!trace.nameSet.has(name)) {
          const entry: AsHookTraceEntry = {
            name,
            order,
            privileged: !!meta.privileged,
            mode,
          };
          trace.nameSet.add(name);
          trace.entries.push(entry);
        }
        return { action: 'setup' as const, order, state };
      }

      if (existing.mode === 'once' || mode === 'once') {
        return { action: 'skip' as const, order: existing.order, state: existing.state };
      }

      return { action: 'configure' as const, order: existing.order, state: existing.state };
    },
    beginCapture: (
      name: string,
      meta: { order: number; privileged: boolean; mode?: AsHookMode }
    ) => {
      frameStack.push(createFrame(name, meta));
    },
    recordCaptured: (kind: EffectKind, entry: unknown) => {
      if (frameStack.length === 0) return;
      const frame = frameStack[frameStack.length - 1];
      frame.effects[kind].push(entry);
    },
    recordAsHookResult: (entry: AsHookChildResult) => {
      ensureSetup('asHook.result');
      const frame = frameStack[frameStack.length - 1];
      if (!frame) return;
      frame.asHooks.push(Object.freeze({ ...entry }));
    },
    registerStateName: (name: string, stateId?: unknown) => {
      ensureSetup('def.state');
      const frame = frameStack[frameStack.length - 1];
      registerStateNameIn(frame ? frame.stateNames : rootStateNames, name, stateId);
    },
    endCapture: (render?: RenderFn): AsHookResult<any, any> => {
      const frame = frameStack.pop();
      if (!frame) return render ? { render } : {};

      const result: AsHookResult = {};
      const props = compact(frame.effects.props);
      const state = compact(frame.effects.state);
      const context = compact(frame.effects.context);
      const event = compact(frame.effects.event);
      const feedback = compact(frame.effects.feedback);
      const stateHandles = collectNamedStateHandles(frame.effects.state);
      const methods = collectExposeMethods(frame.effects.context);
      const propsDisposers = collectDisposers(frame.effects.props);
      const contextDisposers = collectDisposers(
        frame.effects.context,
        (entry) => (entry as any)?.op === 'subscribe' || (entry as any)?.op === 'trySubscribe'
      );
      const ruleDisposers = collectDisposers(
        frame.effects.context,
        (entry) => (entry as any)?.op === 'rule'
      );
      const eventDisposers = collectDisposers(frame.effects.event);
      const feedbackDisposers = collectDisposers(frame.effects.feedback);
      const wrappedPropsDisposers = propsDisposers.map((disposer) =>
        wrapSetupOnlyDisposer(disposer, ensureSetup)
      );
      const wrappedContextDisposers = contextDisposers.map((disposer) =>
        wrapSetupOnlyDisposer(disposer, ensureSetup)
      );
      const wrappedRuleDisposers = ruleDisposers.map((disposer) =>
        wrapSetupOnlyDisposer(disposer, ensureSetup)
      );
      const wrappedEventDisposers = eventDisposers.map((disposer) =>
        wrapSetupOnlyDisposer(disposer, ensureSetup)
      );
      const wrappedFeedbackDisposers = feedbackDisposers.map((disposer) =>
        wrapSetupOnlyDisposer(disposer, ensureSetup)
      );
      const eventKeys = collectEventKeys(frame.effects.event);
      const allDisposers = [
        ...wrappedPropsDisposers,
        ...wrappedContextDisposers,
        ...wrappedRuleDisposers,
        ...wrappedEventDisposers,
        ...wrappedFeedbackDisposers,
      ];

      if (typeof props !== 'undefined') result.props = props;
      if (typeof state !== 'undefined') result.state = state;
      let projectedStateHandles: Record<string, unknown> | undefined;
      if (typeof stateHandles !== 'undefined') {
        projectedStateHandles = projectState(stateHandles) as Record<string, unknown>;
        result.stateHandles = Object.freeze(projectedStateHandles as any);
        result.getState = (key: string) =>
          (projectedStateHandles as Record<string, unknown>)[key] as any;
      }
      if (methods) {
        result.methods = methods;
        result.getMethod = (key: string) => methods[key];
      }
      if (frame.asHooks.length > 0) {
        const asHooks = Object.freeze(frame.asHooks.slice());
        result.asHooks = asHooks;
        result.getAsHook = (name: string) => asHooks.find((entry) => entry.name === name);
        result.getAsHookHandle = <Handle = unknown>(name: string) =>
          asHooks.find((entry) => entry.name === name)?.handle as Handle | undefined;
      }
      if (projectedStateHandles || eventKeys || methods || frame.asHooks.length > 0) {
        const artifacts: Record<string, unknown> = {};
        if (projectedStateHandles) artifacts.stateHandles = result.stateHandles;
        if (eventKeys) artifacts.eventKeys = Object.freeze(eventKeys);
        if (methods) artifacts.methods = methods;
        if (frame.asHooks.length > 0) artifacts.asHooks = result.asHooks;
        result.artifacts = Object.freeze(artifacts);
      }
      if (allDisposers.length > 0) {
        const disposers: Record<string, unknown> = {
          all: Object.freeze(allDisposers.slice()),
        };
        if (propsDisposers.length > 0) {
          disposers.props = Object.freeze(wrappedPropsDisposers.slice());
        }
        if (contextDisposers.length > 0) {
          disposers.context = Object.freeze(wrappedContextDisposers.slice());
        }
        if (ruleDisposers.length > 0) {
          disposers.rule = Object.freeze(wrappedRuleDisposers.slice());
        }
        if (eventDisposers.length > 0) {
          disposers.event = Object.freeze(wrappedEventDisposers.slice());
        }
        if (feedbackDisposers.length > 0) {
          disposers.feedback = Object.freeze(wrappedFeedbackDisposers.slice());
        }
        result.disposers = Object.freeze(disposers as any);
      }
      if (typeof context !== 'undefined') result.context = context;
      if (typeof event !== 'undefined') result.event = event;
      if (typeof feedback !== 'undefined') result.feedback = feedback;
      if (typeof render === 'function') result.render = render;

      return result;
    },
    abortCapture: () => {
      if (frameStack.length === 0) return;
      frameStack.pop();
    },
    projectState: <T>(state: T): T => {
      return projectState(state);
    },
    getTrace: () => trace.entries.slice(),
  };

  bindAsHookRuntime(def as object, runtime);
  return runtime;
}
