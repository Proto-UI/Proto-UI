// packages/modules/event/test/utils/fake-caps.ts
import { SYS_CAP } from '@proto.ui/module-base';
import {
  EVENT_CANCEL_DEFAULT_ACTION_CAP,
  EXPOSE_EVENT_SINK_CAP,
  EVENT_GLOBAL_TARGET_CAP,
  EVENT_ROOT_TARGET_CAP,
} from '../../src/caps';

type ExecPhase = 'setup' | 'render' | 'callback' | 'unknown';
type ProtoPhase = 'setup' | 'mounted' | 'updated' | 'unmounted';

export function createSysCaps() {
  let execPhase: ExecPhase = 'setup';
  let protoPhase: ProtoPhase = 'setup';
  let disposed = false;

  const sys = {
    execPhase: () => execPhase,
    domain: () => (execPhase === 'setup' ? 'setup' : 'runtime'),
    protoPhase: () => protoPhase,
    isDisposed: () => disposed,

    ensureNotDisposed(op: string) {
      if (disposed) throw new Error(`[Disposed] ${op}`);
    },

    ensureExecPhase(op: string, expected: ExecPhase | ExecPhase[]) {
      const list = Array.isArray(expected) ? expected : [expected];
      if (!list.includes(execPhase)) {
        const e = new Error(`[Phase] ${op} expected ${list.join('|')} got ${execPhase}`) as any;
        e.code = 'EVENT_PHASE_VIOLATION';
        throw e;
      }
    },

    ensureSetup(op: string) {
      if (execPhase !== 'setup') {
        const e = new Error(`[Phase] ${op} setup-only, got ${execPhase}`) as any;
        e.code = 'EVENT_PHASE_VIOLATION';
        throw e;
      }
    },

    ensureRuntime(op: string) {
      if (execPhase === 'setup') {
        const e = new Error(`[Phase] ${op} runtime-only, got setup`) as any;
        e.code = 'EVENT_PHASE_VIOLATION';
        throw e;
      }
    },

    ensureCallback(op: string) {
      if (execPhase !== 'callback') {
        const e = new Error(`[Phase] ${op} callback-only, got ${execPhase}`) as any;
        e.code = 'EVENT_PHASE_VIOLATION';
        throw e;
      }
    },

    // test controls
    __setExecPhase(p: ExecPhase) {
      execPhase = p;
    },
    __setProtoPhase(p: ProtoPhase) {
      protoPhase = p;
    },
    __dispose() {
      disposed = true;
    },
  };

  return sys;
}

export function makeCaps(args: {
  sys?: any;
  getRootTarget?: (() => EventTarget | null) | undefined;
  getGlobalTarget?: (() => EventTarget | null) | undefined;
  cancelDefaultAction?:
    | ((request: { event?: unknown; reason?: string; source?: string }) => void)
    | undefined;
}) {
  let epoch = 0;
  const subs = new Set<(epoch: number) => void>();

  const store = new Map<string, any>();

  const sys = args.sys ?? createSysCaps();

  // base: SYS_CAP always present in tests
  store.set(SYS_CAP.id, sys);

  // host-attached: event targets are optional
  if (args.getRootTarget !== undefined) {
    store.set(EVENT_ROOT_TARGET_CAP.id, args.getRootTarget);
  }
  if (args.getGlobalTarget !== undefined) {
    store.set(EVENT_GLOBAL_TARGET_CAP.id, args.getGlobalTarget);
  }
  if (args.cancelDefaultAction !== undefined) {
    store.set(EVENT_CANCEL_DEFAULT_ACTION_CAP.id, args.cancelDefaultAction);
  }

  const api = {
    has(token: any) {
      return store.has(token.id);
    },

    get(token: any) {
      return store.get(token.id);
    },

    onChange(cb: (epoch: number) => void) {
      subs.add(cb);
      return () => subs.delete(cb);
    },

    // test-only: mutate caps entries
    __set(key: 'getRootTarget' | 'getGlobalTarget' | 'exposeEventSink', val: any) {
      const t =
        key === 'getRootTarget'
          ? EVENT_ROOT_TARGET_CAP
          : key === 'getGlobalTarget'
            ? EVENT_GLOBAL_TARGET_CAP
            : EXPOSE_EVENT_SINK_CAP;

      if (val === undefined) store.delete(t.id);
      else store.set(t.id, val);
    },

    // test-only: bump epoch -> should trigger rebind if impl is bound
    __bumpEpoch() {
      epoch++;
      for (const cb of subs) cb(epoch);
    },

    // for convenience in tests
    __sys: sys,
  };

  return api as any;
}
