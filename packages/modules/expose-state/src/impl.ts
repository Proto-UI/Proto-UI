// packages/modules/expose-state/src/impl.ts
import type { CapsVaultView, InstancePhase, OwnedStateHandle } from '@proto.ui/core';
import { ModuleBase } from '@proto.ui/module-base';
import type { ModuleDeps } from '@proto.ui/module-base';
import type { StateEvent, StateSpec } from '@proto.ui/types';

import type { ExposePort } from '@proto.ui/module-expose';
import type { StatePort } from '@proto.ui/module-state';

import {
  EXPOSE_STATE_EXTERNAL_HANDLE,
  type ExposeStateDiag,
  type ExposeStateExternalHandle,
  type ExposeStatePort,
} from './types';
import { EXPOSES_RECORD_SINK_CAP, type ExposesRecordSink } from './caps';

const STATE_ID = '__stateId';
const STATE_SPEC = '__stateSpec';

function isStateHandleLike(x: any): x is OwnedStateHandle<any> {
  return !!x && typeof x === 'object' && typeof x.get === 'function' && !!x[STATE_ID];
}

function getSpecFromHandle(handle: any): StateSpec | null {
  const spec = handle?.[STATE_SPEC] as StateSpec | undefined;
  return spec ?? null;
}

function toDiag(key: string, value: unknown, isState: boolean): ExposeStateDiag {
  return {
    key,
    kind: isState ? 'state' : 'value',
    valueType: typeof value,
  };
}

export class ExposeStateModuleImpl extends ModuleBase {
  private readonly exposePort: ExposePort;
  private readonly statePort: StatePort;
  private disposed = false;

  private cache = new Map<string, unknown>();
  private readonly externalHandleCache = new WeakMap<object, ExposeStateExternalHandle<any>>();
  private readonly externalSubscriptions = new Set<() => void>();
  private publishedSink: ExposesRecordSink | null = null;

  constructor(caps: CapsVaultView, deps: ModuleDeps) {
    super(caps);
    this.exposePort = deps.requirePort<ExposePort>('expose');
    this.statePort = deps.requirePort<StatePort>('state');
  }

  // -------------------------
  // runtime port
  // -------------------------

  readonly port: ExposeStatePort = {
    get: (key) => {
      this.ensureAlive('rt.exposeState.get');
      this.sync();
      return this.cache.get(key);
    },

    getAll: () => {
      this.ensureAlive('rt.exposeState.getAll');
      this.sync();
      const out: Record<string, unknown> = {};
      for (const [k, v] of this.cache) {
        Object.defineProperty(out, k, {
          value: v,
          enumerable: true,
          configurable: true,
          writable: true,
        });
      }
      return out;
    },

    getDiagnostics: () => {
      this.ensureAlive('rt.exposeState.getDiagnostics');
      this.sync();
      const diags: ExposeStateDiag[] = [];
      for (const [k, v] of this.cache) {
        const isState = isStateHandleLike(v) || (v as any)?.spec !== undefined;
        diags.push(toDiag(k, v, isState));
      }
      return diags;
    },
  };

  // -------------------------
  // lifecycle + caps wiring
  // -------------------------

  override onInstancePhase(phase: InstancePhase): void {
    super.onInstancePhase(phase);
    if (phase === 'alive') this.publishToHost();
  }

  afterRenderCommit(): void {
    this.publishToHost();
  }

  protected override onCapsEpoch(_epoch: number): void {
    this.publishToHost();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const off of this.externalSubscriptions) {
      try {
        off();
      } catch {}
    }
    this.externalSubscriptions.clear();
    this.cache.clear();
    this.publishToHost(true);
  }

  // -------------------------
  // helpers
  // -------------------------

  private ensureAlive(op: string) {
    this.sys?.ensureNotDisposed(op);
    if (this.disposed) throw new Error(`[ExposeState] disposed. op=${op}`);
  }

  private sync(): void {
    const raw = this.exposePort.getAll();

    this.cache.clear();

    for (const [key, value] of Object.entries(raw)) {
      if (!isStateHandleLike(value)) {
        this.cache.set(key, value);
        continue;
      }

      const spec = getSpecFromHandle(value);
      if (!spec) {
        throw new Error(`[ExposeState] missing StateSpec on exposed handle: ${key}`);
      }

      let external = this.externalHandleCache.get(value);
      if (!external) {
        external = this.wrapExternalHandle(value, spec);
        this.externalHandleCache.set(value, external);
      }
      this.cache.set(key, external);
    }
  }

  private wrapExternalHandle<V>(
    handle: OwnedStateHandle<V>,
    spec: StateSpec
  ): ExposeStateExternalHandle<V> {
    const external: ExposeStateExternalHandle<V> = {
      [EXPOSE_STATE_EXTERNAL_HANDLE]: true,
      get: () => {
        this.ensureAlive('rt.exposeState.external.get');
        return handle.get();
      },
      subscribe: (cb) => {
        this.ensureAlive('rt.exposeState.external.subscribe');
        const off = this.statePort.watch(handle, (_ctx, e: StateEvent<V>) => {
          if (this.disposed) return;
          cb(e);
        });
        const trackedOff = () => {
          this.externalSubscriptions.delete(trackedOff);
          off();
        };
        this.externalSubscriptions.add(trackedOff);
        return trackedOff;
      },
      unsubscribe: (off) => {
        if (typeof off === 'function') off();
      },
      spec,
    };

    (external as any).__stateSemantic = (handle as any).__stateSemantic;
    (external as any).__stateId = (handle as any).__stateId;

    return external;
  }

  private publishToHost(clear = false): void {
    const nextSink =
      !clear && this.caps.has(EXPOSES_RECORD_SINK_CAP)
        ? this.caps.get(EXPOSES_RECORD_SINK_CAP)
        : null;

    if (this.publishedSink && this.publishedSink !== nextSink) {
      try {
        this.publishedSink({});
      } catch {}
    }
    this.publishedSink = nextSink;

    if (clear || !nextSink || this.instancePhase === 'setup') return;

    const record = this.port.getAll();
    try {
      nextSink(record);
    } catch {
      // ignore host errors
    }
  }
}
