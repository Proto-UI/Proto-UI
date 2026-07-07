// packages/adapters/base/src/host/adapter-host.ts
import type { Prototype } from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';
import { executeWithHost, type RuntimeHost, type ExecuteWithHostResult } from '@proto.ui/runtime';
import { createTeardown } from '../lifecycle/teardown';

export type AdapterHostHooks<P extends PropsBaseType> = {
  onRuntimeReady?: RuntimeHost<P>['onRuntimeReady'];
  onUnmountBegin?: RuntimeHost<P>['onUnmountBegin'];
  afterUnmount?: () => void;
};

export type AdapterHostInput<P extends PropsBaseType> = Pick<
  RuntimeHost<P>,
  'commit' | 'schedule' | 'scheduleDelay' | 'getRawProps' | 'onLifecycleCheckpoint'
>;

export type AdapterHostSession<P extends PropsBaseType> = {
  controller: ExecuteWithHostResult['controller'];
  dispose(): void;
  caps: ExecuteWithHostResult['caps'];
  invokeInCallbackScope: ExecuteWithHostResult['invokeInCallbackScope'];
  kernel: ExecuteWithHostResult['kernel'];
};

export function createAdapterHost<P extends PropsBaseType>(
  proto: Prototype<P>,
  host: AdapterHostInput<P>,
  hooks: AdapterHostHooks<P> = {}
): AdapterHostSession<P> {
  const teardown = createTeardown();

  const res = executeWithHost(proto, {
    prototypeName: proto.name,
    getRawProps: host.getRawProps,
    commit: host.commit,
    schedule: host.schedule,
    scheduleDelay: host.scheduleDelay ?? defaultScheduleDelay,
    onLifecycleCheckpoint: host.onLifecycleCheckpoint,
    onRuntimeReady: hooks.onRuntimeReady,
    onUnmountBegin: hooks.onUnmountBegin,
  });

  return {
    controller: res.controller,
    caps: res.caps,
    invokeInCallbackScope: res.invokeInCallbackScope,
    kernel: res.kernel,
    dispose() {
      teardown.run(() => {
        res.invokeUnmounted();
        hooks.afterUnmount?.();
      });
    },
  };
}

function defaultScheduleDelay(durationMs: number, task: () => void): { cancel(): void } {
  const timer = setTimeout(task, durationMs);
  return {
    cancel() {
      clearTimeout(timer);
    },
  };
}
