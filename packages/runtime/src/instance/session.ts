import type {
  InstancePhase,
  MountPhase,
  Prototype,
  RunHandle,
  TemplateChildren,
} from '@proto.ui/core';
import type { PropsBaseType } from '@proto.ui/types';
import type { PropsFacade, PropsPort } from '@proto.ui/module-props';
import type { RulePort } from '@proto.ui/module-rule';
import type { EventPort } from '@proto.ui/module-event';
import type { PresencePort } from '@proto.ui/module-presence';
import type { A11yPort } from '@proto.ui/module-a11y';

import { __RT_EVENT_CALLBACKS } from '../kernel/event';
import { projectLegacyCheckpoint, type RuntimeLifecycleEvent } from '../kernel/lifecycle-events';
import { createRuntimeInstance } from './instance';
import type { RuntimeHost } from './host';
import type { RuntimeController } from './execute/types';
import type { ModuleOrchestrator } from '../orchestrator/module-orchestrator';
import type { Kernel } from '../kernel';
import type { ViewIntentView } from '../kernel';

export interface RuntimeSession<P extends PropsBaseType = PropsBaseType> {
  readonly controller: RuntimeController;
  readonly instancePhase: InstancePhase;
  readonly mountPhase: MountPhase;
  readonly mountEpoch: number;
  readonly children: TemplateChildren;
  readonly viewIntent: ViewIntentView;

  mount(): Promise<void>;
  unmount(): Promise<void>;
  dispose(): Promise<void>;

  readonly caps: ModuleOrchestrator;
  invokeInCallbackScope(fn: () => void): void;
  readonly kernel: Kernel<P>;
}

function attemptCleanup(action: () => void, recordFailure: (error: unknown) => void) {
  try {
    action();
  } catch (error) {
    recordFailure(error);
  }
}

export function createRuntimeSession<P extends PropsBaseType>(
  proto: Prototype<P>,
  host: RuntimeHost<P>
): RuntimeSession<P> {
  const emit = (event: RuntimeLifecycleEvent) => {
    host.onLifecycleEvent?.(event);
    const legacy = projectLegacyCheckpoint(event);
    if (legacy) host.onLifecycleCheckpoint?.(legacy);
  };

  const inst = createRuntimeInstance(proto, {
    allowRunUpdate: true,
    onModulesReady: (hub) => {
      host.onRuntimeReady?.(hub.getWiring());
    },
  });

  const { kernel, moduleHub, callbackScope } = inst;
  const { lifecycle, run } = kernel;
  const propsFacade = moduleHub.getFacades()['props'] as PropsFacade<P>;
  const propsPort = moduleHub.getPort<PropsPort<P>>('props');
  const rulePort = moduleHub.getPort<RulePort<P>>('rule');

  if (!propsPort) throw new Error('props port not found');

  // Register after author setup watches so Rule styles observe accepted,
  // net-changed resolved Props at the same callback-safe delivery point.
  if (rulePort) propsFacade.watchAll(() => rulePort.requestStyleReevaluation());

  let instancePhase: InstancePhase = 'setup';
  let mountPhase: MountPhase = 'detached';
  let mountEpoch = 0;
  let transitionVersion = 0;
  let revision = 0;
  let dirty = false;
  let children: TemplateChildren = [];
  let updateState: { inFlight: boolean; queued: boolean };
  let mountPending:
    | { promise: Promise<void>; resolve: () => void; reject: (error: unknown) => void }
    | undefined;
  let unmountPending: Promise<void> | undefined;
  let unmountVersion = 0;
  let unmountWaitingForPresence = false;
  let disposePending: Promise<void> | undefined;
  const pendingDelayTasks = new Set<{ cancel(): void }>();

  const cancelPendingDelayTasks = () => {
    let failed = false;
    let firstError: unknown;
    for (const task of [...pendingDelayTasks]) {
      try {
        task.cancel();
      } catch (error) {
        if (!failed) {
          failed = true;
          firstError = error;
        }
      }
    }
    pendingDelayTasks.clear();
    if (failed) throw firstError;
  };

  callbackScope.setDelayContext({
    prototypeName: host.prototypeName,
    scheduleDelay(durationMs, callback) {
      if (instancePhase !== 'alive') {
        throw new Error(
          `[Delay] cannot schedule delayed work in instance phase=${instancePhase}: ${host.prototypeName}`
        );
      }
      if (!host.scheduleDelay) {
        throw new Error(
          `[Delay] host scheduler is not available for ${host.prototypeName}. Provide RuntimeHost.scheduleDelay.`
        );
      }

      let active = true;
      let hostTask: { cancel(): void } | undefined;
      const task = {
        cancel() {
          if (!active) return;
          active = false;
          pendingDelayTasks.delete(task);
          hostTask?.cancel();
        },
      };

      const invoke = () => {
        if (!active) return;
        active = false;
        pendingDelayTasks.delete(task);
        if (instancePhase !== 'alive') return;
        callbackScope.run(run, callback);
      };

      pendingDelayTasks.add(task);
      try {
        hostTask = host.scheduleDelay(durationMs, invoke);
      } catch (error) {
        active = false;
        pendingDelayTasks.delete(task);
        throw error;
      }
      return task;
    },
  });

  const setInstancePhase = (phase: InstancePhase) => {
    instancePhase = phase;
    moduleHub.setInstancePhase(phase);
    emit({ type: 'instance.phase', phase });
  };

  const setMountPhase = (phase: MountPhase, epoch = mountEpoch) => {
    mountPhase = phase;
    moduleHub.setMountPhase(phase, epoch);
    emit({ type: 'mount.phase', phase, epoch });
  };

  const bindEvents = () => {
    const eventPort = moduleHub.getPort<EventPort>('event');
    const eventRegistry = (moduleHub as any)[__RT_EVENT_CALLBACKS] as
      | { dispatch: (run: RunHandle<P>, id: string, ev: unknown) => void }
      | undefined;

    if (!eventPort?.bind) return;
    eventPort.bind((id: string, ev: unknown) => {
      if (instancePhase !== 'alive' || mountPhase !== 'mounted') return;
      callbackScope.run(run, () => {
        eventPort.dispatchInternal?.(id, ev);
        eventRegistry?.dispatch(run, id, ev);
      });
    });
  };

  const renderCommit = (
    kind: 'mount' | 'update',
    epoch: number,
    updateRevision: number,
    onCommitted: () => void
  ) => {
    propsPort.syncFromHost();
    children = inst.renderOnce();

    if (kind === 'mount') {
      emit({ type: 'mount.render', epoch });
      emit({ type: 'mount.commit.start', epoch });
    } else {
      emit({ type: 'update.render', epoch, revision: updateRevision });
    }

    let commitDone = false;
    host.commit(children, {
      done() {
        if (commitDone) return;
        commitDone = true;

        const activeCommit =
          instancePhase === 'alive' &&
          epoch === mountEpoch &&
          (kind === 'mount'
            ? mountPhase === 'mounting' || mountPhase === 'mounted'
            : mountPhase === 'mounted');

        if (activeCommit) {
          if (kind === 'mount') {
            emit({ type: 'mount.commit.done', epoch });
          } else {
            emit({ type: 'update.commit.done', epoch, revision: updateRevision });
          }

          bindEvents();
          moduleHub.afterRenderCommit();
        }

        onCommitted();
      },
    });
  };

  const evaluateRuleStyle = () => {
    propsPort.syncFromHost();
    const current = propsFacade.get();
    if (!rulePort) return [];
    const result = rulePort.evaluate({ props: current });
    return result.kind === 'plan' && result.plan.kind === 'style.tokens' ? result.plan.tokens : [];
  };

  const startUpdate = () => {
    if (instancePhase !== 'alive') return;

    if (mountPhase !== 'mounted') {
      // A detached Proto instance must still observe host props. Otherwise a
      // controlled prop cannot request its own first/rematerialized view
      // through run.lifecycle.setPresent(), creating a mount-before-update
      // deadlock. Only view rendering/commit is gated by mount phase.
      callbackScope.run(run, () => {});
      dirty = true;
      return;
    }
    const update = updateState;
    if (update.inFlight) {
      update.queued = true;
      return;
    }

    update.inFlight = true;
    const epoch = mountEpoch;
    const currentRevision = ++revision;

    try {
      renderCommit('update', epoch, currentRevision, () => {
        update.inFlight = false;

        if (instancePhase !== 'alive' || mountPhase !== 'mounted' || epoch !== mountEpoch) {
          dirty = true;
          update.queued = false;
          return;
        }

        moduleHub.setProtoPhase('updated');
        emit({ type: 'update.updated', epoch, revision: currentRevision });
        callbackScope.run(run, () => {
          for (const cb of lifecycle.updated) cb(run);
        });

        if (!update.queued || epoch !== mountEpoch) return;
        update.queued = false;
        startUpdate();
      });
    } catch (error) {
      update.inFlight = false;
      update.queued = false;
      throw error;
    }
  };

  const controller: RuntimeController = {
    applyRawProps(nextRaw) {
      if (instancePhase === 'disposed') return;
      propsPort.applyRaw({ ...(nextRaw ?? {}) });
      callbackScope.runNoSync(run, () => {});
    },
    update() {
      if (instancePhase === 'disposing' || instancePhase === 'disposed') return;
      startUpdate();
    },
    getRuleStyleTokens() {
      return evaluateRuleStyle();
    },
  };

  (run as any).update = () => controller.update();

  const mount = (): Promise<void> => {
    if (instancePhase !== 'alive') {
      return Promise.reject(
        new Error(`[Lifecycle] cannot mount instance in phase=${instancePhase}`)
      );
    }
    if (mountPhase === 'mounted') return Promise.resolve();
    if (mountPhase === 'mounting' && mountPending) return mountPending.promise;
    if (mountPhase === 'unmounting' && unmountPending) {
      return unmountPending.then(() => mount());
    }

    const epoch = ++mountEpoch;
    updateState = { inFlight: false, queued: false };
    const version = ++transitionVersion;
    setMountPhase('mounting', epoch);

    let resolveMount!: () => void;
    let rejectMount!: (error: unknown) => void;
    const promise = new Promise<void>((resolve, reject) => {
      resolveMount = resolve;
      rejectMount = reject;
    });
    mountPending = { promise, resolve: resolveMount, reject: rejectMount };

    const finishMount = () => {
      if (
        transitionVersion !== version ||
        instancePhase !== 'alive' ||
        mountPhase !== 'mounted' ||
        mountEpoch !== epoch
      ) {
        resolveMount();
        return;
      }

      emit({ type: 'mount.mounted', epoch });
      callbackScope.run(run, () => {
        for (const cb of lifecycle.mounted) cb(run);
      });
      dirty = false;
      mountPending = undefined;
      resolveMount();
    };

    try {
      renderCommit('mount', epoch, 0, () => {
        const presence = moduleHub.getPort<PresencePort>('presence')?.awaitMount();
        const scheduleFinish = () => {
          if (transitionVersion !== version) {
            resolveMount();
            return;
          }
          // The view is mounted once commit and presence approval complete.
          // The author callback remains host-scheduled and can still be
          // invalidated by an intervening unmount.
          moduleHub.setProtoPhase('mounted');
          setMountPhase('mounted', epoch);
          let scheduleReturned = false;
          host.schedule(() => {
            try {
              finishMount();
            } catch (error) {
              mountPending = undefined;
              if (!scheduleReturned) throw error;
              rejectMount(error);
            }
          });
          scheduleReturned = true;
        };
        if (presence) presence.then(scheduleFinish, scheduleFinish);
        else scheduleFinish();
      });
    } catch (error) {
      mountPending = undefined;
      setMountPhase('detached', epoch);
      // Preserve fail-fast behavior for synchronous setup/render/commit
      // violations. The promise was not returned yet, so rejecting it here
      // would create an unhandled rejection in legacy eager callers.
      resolveMount();
      throw error;
    }

    return promise;
  };

  const unmountInternal = (force = false): Promise<void> => {
    if (mountPhase === 'detached') return Promise.resolve();
    if (mountPhase === 'unmounting' && unmountPending && (!force || !unmountWaitingForPresence))
      return unmountPending;

    // Publish completion before phase observers or unmount callbacks can reenter.
    // Terminal disposal may supersede a presence wait, but never a callback pass.
    let resolveUnmount!: () => void;
    let rejectUnmount!: (error: unknown) => void;
    const pending = new Promise<void>((resolve, reject) => {
      resolveUnmount = resolve;
      rejectUnmount = reject;
    });
    unmountPending = pending;
    unmountWaitingForPresence = false;

    const epoch = mountEpoch;
    const currentUnmountVersion = ++unmountVersion;
    ++transitionVersion;
    mountPending?.resolve();
    mountPending = undefined;
    let callbackFailed = false;
    let callbackError: unknown;
    const recordFailure = (error: unknown) => {
      if (!callbackFailed) {
        callbackFailed = true;
        callbackError = error;
      }
    };
    attemptCleanup(() => setMountPhase('unmounting', epoch), recordFailure);
    attemptCleanup(cancelPendingDelayTasks, recordFailure);

    void (async () => {
      // A repeatable detach honors presence/transition approval. Terminal
      // disposal is host-authoritative and must not be held alive by a view
      // transition after the owning host component has already gone away.
      const presencePort = moduleHub.getPort<PresencePort>('presence');
      const terminal = force || instancePhase === 'disposing';
      if (terminal) attemptCleanup(() => presencePort?.forceUnmount(), recordFailure);
      const presence = terminal ? undefined : presencePort?.awaitUnmount();
      if (presence) {
        unmountWaitingForPresence = true;
        await presence;
      }
      if (currentUnmountVersion !== unmountVersion) return;
      unmountWaitingForPresence = false;

      attemptCleanup(() => emit({ type: 'unmount.begin', epoch }), recordFailure);
      attemptCleanup(() => host.onUnmountBegin?.(), recordFailure);
      attemptCleanup(() => moduleHub.getPort<EventPort>('event')?.unbind?.(), recordFailure);
      attemptCleanup(
        () =>
          callbackScope.run(run, () => {
            for (const cb of lifecycle.unmounted) cb(run);
          }),
        recordFailure
      );
      attemptCleanup(() => setMountPhase('detached', epoch), recordFailure);
      attemptCleanup(cancelPendingDelayTasks, recordFailure);
      attemptCleanup(() => emit({ type: 'unmount.done', epoch }), recordFailure);
      if (unmountPending === pending) unmountPending = undefined;
      if (callbackFailed) throw callbackError;
    })().then(resolveUnmount, rejectUnmount);

    return pending;
  };

  const unmount = (): Promise<void> => unmountInternal(false);

  const beginDispose = () => {
    let failed = false;
    let firstError: unknown;
    const recordFailure = (error: unknown) => {
      if (!failed) {
        failed = true;
        firstError = error;
      }
    };
    attemptCleanup(() => setInstancePhase('disposing'), recordFailure);
    attemptCleanup(cancelPendingDelayTasks, recordFailure);
    attemptCleanup(kernel.viewIntent.lockTerminal, recordFailure);
    attemptCleanup(() => emit({ type: 'instance.dispose.begin' }), recordFailure);
    return { failed, error: firstError };
  };

  const finalizeDispose = (completeFailedCreation = false) => {
    let failed = false;
    let finalError: unknown;
    const recordFailure = (error: unknown) => {
      if (!failed) {
        failed = true;
        finalError = error;
      }
    };
    attemptCleanup(
      () =>
        callbackScope.run(
          run,
          () => {
            for (const cb of lifecycle.beforeDispose) attemptCleanup(() => cb(run), recordFailure);
          },
          completeFailedCreation ? recordFailure : undefined
        ),
      recordFailure
    );

    // The kernel installs its private callback registry on this orchestrator.
    const eventRegistry = (
      moduleHub as ModuleOrchestrator & { [__RT_EVENT_CALLBACKS]?: { clear(): void } }
    )[__RT_EVENT_CALLBACKS];
    attemptCleanup(() => eventRegistry?.clear?.(), recordFailure);

    // Legacy terminal notification; repeatable unmount keeps logical resources.
    attemptCleanup(() => moduleHub.setProtoPhase('unmounted'), recordFailure);
    attemptCleanup(
      () => moduleHub.getPort<PresencePort>('presence')?.setLifecycleDriver(null),
      recordFailure
    );
    attemptCleanup(cancelPendingDelayTasks, recordFailure);
    attemptCleanup(inst.dispose, recordFailure);
    attemptCleanup(() => setInstancePhase('disposed'), recordFailure);
    attemptCleanup(() => emit({ type: 'instance.dispose.done' }), recordFailure);
    return { failed, error: finalError };
  };

  const dispose = (): Promise<void> => {
    if (disposePending) return disposePending;
    if (instancePhase === 'disposed') return Promise.resolve();
    // Publish the shared completion before any callback can reenter disposal.
    let resolveDispose!: () => void;
    let rejectDispose!: (error: unknown) => void;
    const pending = new Promise<void>((resolve, reject) => {
      resolveDispose = resolve;
      rejectDispose = reject;
    });
    disposePending = pending;
    const succeed = () => {
      disposePending = undefined;
      resolveDispose();
    };
    const fail = (error: unknown) => {
      disposePending = undefined;
      rejectDispose(error);
    };
    try {
      const beginError = beginDispose();
      const unmountResult = unmountInternal(true);
      // Preserve deterministic terminal invalidation when no asynchronous
      // presence transition blocks unmount. Otherwise finalize in completion.
      // The returned Promise still carries callback errors to async-aware callers.
      const finalError = mountPhase === 'detached' ? finalizeDispose() : undefined;
      const completion = unmountResult.then(
        () => {
          const result = finalError ?? finalizeDispose();
          if (beginError.failed) throw beginError.error;
          if (result.failed) throw result.error;
        },
        (unmountError) => {
          if (!finalError) finalizeDispose();
          if (beginError.failed) throw beginError.error;
          throw unmountError;
        }
      );

      completion.then(succeed, fail);
    } catch (error) {
      fail(error);
    }
    return pending;
  };

  try {
    emit({ type: 'instance.setup.exit' });
    propsPort.applyRaw({ ...(host.getRawProps?.() ?? {}) });
    // Register before hosts subscribe: revoke relationship leases before a
    // ViewIntent can hide or remove its physical view. Terminal lock clears it.
    kernel.viewIntent.subscribe(({ present }) => {
      moduleHub.getPort<A11yPort>('a11y')?.prepareViewPresence(present);
    });
    setInstancePhase('alive');
    callbackScope.run(run, () => {
      for (const cb of lifecycle.created) cb(run);
    });
    emit({ type: 'instance.created' });
  } catch (creationError) {
    // No session was published and no view was mounted. Retire acquired state
    // synchronously without creating a rejected disposal Promise; secondary
    // cleanup failures cannot replace the initiating thrown value.
    beginDispose();
    finalizeDispose(true);
    throw creationError;
  }

  if (host.presenceLifecycle === 'session') {
    moduleHub.getPort<PresencePort>('presence')?.setLifecycleDriver({
      requestMount() {
        void mount();
      },
      requestUnmount() {
        void unmount();
      },
    });
  }

  return {
    controller,
    get instancePhase() {
      return instancePhase;
    },
    get mountPhase() {
      return mountPhase;
    },
    get mountEpoch() {
      return mountEpoch;
    },
    get children() {
      return children;
    },
    viewIntent: kernel.viewIntent,
    mount,
    unmount,
    dispose,
    caps: moduleHub,
    invokeInCallbackScope: (fn) => callbackScope.run(run, fn),
    kernel,
  };
}
