// packages/modules/props/src/types.ts
import type { PropsBaseType, PropsSpecMap } from '@proto.ui/types';
import type {
  ModuleInstance,
  PropsDefaults,
  PropsSnapshot,
  Unsubscribe,
  WatchInfo,
} from '@proto.ui/core';

export type RawPropsSource<P extends PropsBaseType> = {
  debugName?: string;
  get(): Record<string, any>;
  subscribe(cb: () => void): () => void;
};

export type PropsCallbackCtx = unknown;

// Module-facing callbacks (do NOT reference RunHandle)
export type PropsWatchCb<P extends PropsBaseType> = (
  ctx: PropsCallbackCtx,
  next: PropsSnapshot<P>,
  prev: PropsSnapshot<P>,
  info: WatchInfo<P>
) => void;

export type RawWatchCb<P extends PropsBaseType> = (
  ctx: PropsCallbackCtx,
  nextRaw: Readonly<P & PropsBaseType>,
  prevRaw: Readonly<P & PropsBaseType>,
  info: WatchInfo<P & PropsBaseType>
) => void;

export type PropsKernelDiag = {
  level: 'warning' | 'error';
  message: string;
  key?: string;
};

export type PropsWatchTask<P extends PropsBaseType> =
  | {
      kind: 'resolved';
      cb: PropsWatchCb<P>;
      next: PropsSnapshot<P>;
      prev: PropsSnapshot<P>;
      info: WatchInfo<P>;
    }
  | {
      kind: 'raw';
      cb: RawWatchCb<P>;
      next: Readonly<P & PropsBaseType>;
      prev: Readonly<P & PropsBaseType>;
      info: WatchInfo<P & PropsBaseType>;
    };

export type PropsFacade<P extends PropsBaseType> = {
  // setup-only (guarded in impl)
  define: (decl: Partial<PropsSpecMap<P>>) => void;
  setDefaults: (partial: PropsDefaults<P>) => void;

  // setup-only subscriptions (module-facing callbacks; ctx is unknown)
  watch: (keys: (keyof P & string)[], cb: PropsWatchCb<P>) => Unsubscribe;
  watchAll: (cb: PropsWatchCb<P>) => Unsubscribe;
  watchRaw: (keys: (keyof P & string)[], cb: RawWatchCb<P & PropsBaseType>) => Unsubscribe;
  watchRawAll: (cb: RawWatchCb<P & PropsBaseType>) => Unsubscribe;

  // runtime read API
  get: () => PropsSnapshot<P>;
  getRaw: () => Readonly<P & PropsBaseType>;
  isProvided: (key: keyof P) => boolean;
};

export type PropsPort<P extends PropsBaseType> = {
  // internal sync points (NO run)
  syncFromHost(): void;
  applyRaw(nextRaw: Record<string, any>): void;

  // internal: runtime pulls tasks and dispatches with ctx=run
  consumeTasks(): PropsWatchTask<P>[];

  getDiagnostics(): readonly PropsKernelDiag[];
};

export type PropsModule<P extends PropsBaseType> = ModuleInstance<PropsFacade<P>> & {
  name: 'props';
  scope: 'instance';
  port: PropsPort<P>;
};
