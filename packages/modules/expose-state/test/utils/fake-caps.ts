// packages/modules/expose-state/test/utils/fake-caps.ts
import { SYS_CAP } from '@proto.ui/module-base';
import { EXPOSES_RECORD_SINK_CAP } from '../../src/caps';

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
        e.code = 'EXPOSE_STATE_PHASE_VIOLATION';
        throw e;
      }
    },

    ensureSetup(op: string) {
      if (execPhase !== 'setup') {
        const e = new Error(`[Phase] ${op} setup-only, got ${execPhase}`) as any;
        e.code = 'EXPOSE_STATE_PHASE_VIOLATION';
        throw e;
      }
    },

    ensureRuntime(op: string) {
      if (execPhase === 'setup') {
        const e = new Error(`[Phase] ${op} runtime-only, got setup`) as any;
        e.code = 'EXPOSE_STATE_PHASE_VIOLATION';
        throw e;
      }
    },

    ensureCallback(op: string) {
      if (execPhase !== 'callback') {
        const e = new Error(`[Phase] ${op} callback-only, got ${execPhase}`) as any;
        e.code = 'EXPOSE_STATE_PHASE_VIOLATION';
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

export function makeCaps(args: { sys?: any; setExposes?: any }) {
  let epoch = 0;
  const subs = new Set<(epoch: number) => void>();

  const store = new Map<string, any>();
  const sys = args.sys ?? createSysCaps();

  store.set(SYS_CAP.id, sys);

  if (args.setExposes !== undefined) {
    store.set(EXPOSES_RECORD_SINK_CAP.id, args.setExposes);
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

    __set(key: 'setExposes', val: any) {
      if (val === undefined) store.delete(EXPOSES_RECORD_SINK_CAP.id);
      else store.set(EXPOSES_RECORD_SINK_CAP.id, val);
    },

    __bumpEpoch() {
      epoch++;
      for (const cb of subs) cb(epoch);
    },

    __sys: sys,
  };

  return api as any;
}
