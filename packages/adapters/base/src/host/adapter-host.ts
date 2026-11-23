// packages/adapters/base/src/host/adapter-host.ts
import type { Prototype } from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';
import { createRuntimeSession, type RuntimeHost, type RuntimeSession } from '@proto.ui/runtime';

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
  | 'viewOperations'
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
    viewOperations: host.viewOperations,
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
      if (disposePromise) return disposePromise;
      let resolveDispose!: () => void;
      let rejectDispose!: (error: unknown) => void;
      // Publish the sole completion before Runtime or Adapter cleanup can
      // synchronously reenter. Returning a fresh resolved Promise here would
      // falsely report success before the original disposal has completed.
      disposePromise = new Promise<void>((resolve, reject) => {
        resolveDispose = resolve;
        rejectDispose = reject;
      });
      try {
        const runtimeDispose = Promise.resolve(session.dispose());

        // RuntimeSession deliberately completes the terminal transition
        // synchronously when no unmount callback pass remains outstanding. Keep
        // adapter resource disposal in that same turn so DOM listeners do not
        // outlive their host/test environment by an extra microtask.
        if (session.instancePhase === 'disposed') {
          let afterUnmountFailed = false;
          let afterUnmountError: unknown;
          try {
            finishAfterUnmount();
          } catch (error) {
            afterUnmountFailed = true;
            afterUnmountError = error;
          }
          void runtimeDispose.then(() => {
            if (afterUnmountFailed) rejectDispose(afterUnmountError);
            else resolveDispose();
          }, rejectDispose);
        } else {
          void runtimeDispose.then(
            () => {
              try {
                finishAfterUnmount();
                resolveDispose();
              } catch (error) {
                rejectDispose(error);
              }
            },
            (runtimeError) => {
              try {
                finishAfterUnmount();
              } catch {
                // As in the synchronous terminal path, the initiating Runtime
                // failure remains primary after adapter cleanup was attempted.
              }
              rejectDispose(runtimeError);
            }
          );
        }
      } catch (error) {
        rejectDispose(error);
      }
      return disposePromise;
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
