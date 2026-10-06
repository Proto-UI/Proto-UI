// packages/adapters/base/src/host/adapter-host.ts
import type { Prototype } from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';
import { createRuntimeSession, type RuntimeHost, type RuntimeSession } from '@proto.ui/runtime';
import { createTeardown } from '../lifecycle/teardown';

export type AdapterHostHooks<P extends PropsBaseType> = {
  onRuntimeReady?: RuntimeHost<P>['onRuntimeReady'];
  onUnmountBegin?: RuntimeHost<P>['onUnmountBegin'];
  afterUnmount?: () => void;
};

export type AdapterHostInput<P extends PropsBaseType> = Pick<
  RuntimeHost<P>,
  | 'commit'
  | 'schedule'
  | 'scheduleDelay'
  | 'getRawProps'
  | 'getInstanceAssociations'
  | 'onLifecycleCheckpoint'
  | 'onLifecycleEvent'
  | 'presenceLifecycle'
>;

export type AdapterHostOptions = {
  /** Existing adapters stay eager; detached owners opt into manual first mount. */
  initialMount?: 'eager' | 'manual';
};

export type AdapterHostSession<P extends PropsBaseType> = {
  controller: RuntimeSession<P>['controller'];
  mount(): Promise<void>;
  unmount(): Promise<void>;
  dispose(): Promise<void>;
  viewIntent: RuntimeSession<P>['viewIntent'];
  caps: RuntimeSession<P>['caps'];
  invokeInCallbackScope: RuntimeSession<P>['invokeInCallbackScope'];
  kernel: RuntimeSession<P>['kernel'];
};

export function createAdapterHost<P extends PropsBaseType>(
  proto: Prototype<P>,
  host: AdapterHostInput<P>,
  hooks: AdapterHostHooks<P> = {},
  options: AdapterHostOptions = {}
): AdapterHostSession<P> {
  const teardown = createTeardown();
  let disposePromise: Promise<void> | null = null;
  let afterUnmountDone = false;

  const finishAfterUnmount = () => {
    if (afterUnmountDone) return;
    afterUnmountDone = true;
    hooks.afterUnmount?.();
  };

  const session = createRuntimeSession(proto, {
    prototypeName: proto.name,
    getRawProps: host.getRawProps,
    getInstanceAssociations: host.getInstanceAssociations,
    commit: host.commit,
    schedule: host.schedule,
    scheduleDelay: host.scheduleDelay ?? defaultScheduleDelay,
    onLifecycleCheckpoint: host.onLifecycleCheckpoint,
    onLifecycleEvent: host.onLifecycleEvent,
    presenceLifecycle: host.presenceLifecycle,
    onRuntimeReady: hooks.onRuntimeReady,
    onUnmountBegin: hooks.onUnmountBegin,
  });
  if (options.initialMount !== 'manual') void session.mount();

  return {
    controller: session.controller,
    viewIntent: session.viewIntent,
    caps: session.caps,
    invokeInCallbackScope: session.invokeInCallbackScope,
    kernel: session.kernel,
    mount: () => session.mount(),
    unmount: () => session.unmount(),
    dispose() {
      teardown.run(() => {
        const runtimeDispose = Promise.resolve(session.dispose());

        // RuntimeSession deliberately completes the terminal transition
        // synchronously when no async presence transition is pending. Keep
        // adapter resource disposal in that same turn so DOM listeners do not
        // outlive their host/test environment by an extra microtask.
        if (session.instancePhase === 'disposed') {
          let afterUnmountError: unknown;
          try {
            finishAfterUnmount();
          } catch (error) {
            afterUnmountError = error;
          }
          disposePromise = runtimeDispose.then(() => {
            if (afterUnmountError) throw afterUnmountError;
          });
          return;
        }

        disposePromise = runtimeDispose.finally(finishAfterUnmount);
      });
      return disposePromise ?? Promise.resolve();
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
