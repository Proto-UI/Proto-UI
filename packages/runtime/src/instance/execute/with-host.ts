// packages/runtime/src/instance/execute/with-host.ts
import { Prototype, RunHandle } from '@proto.ui/core';
import { PropsBaseType } from '@proto.ui/types';
import { RuntimeHost } from '../host';
import { ExecuteWithHostResult, RuntimeController } from './types';
import { createTimeline } from '../../kernel/timeline';
import type { PropsFacade, PropsPort } from '@proto.ui/module-props';
import type { RulePort } from '@proto.ui/module-rule';
import { EventPort } from '@proto.ui/module-event';
import type { PresencePort } from '@proto.ui/module-presence';
import { __RT_EVENT_CALLBACKS } from '../../kernel/event';
import { createRuntimeInstance } from '../instance';

export function executeWithHost<P extends PropsBaseType>(
  proto: Prototype<P>,
  host: RuntimeHost<P>
): ExecuteWithHostResult {
  const timeline = createTimeline({ onMark: (cp) => host.onLifecycleCheckpoint?.(cp) });

  const inst = createRuntimeInstance(proto, {
    allowRunUpdate: true,
    onModulesReady: (hub) => {
      host.onRuntimeReady?.(hub.getWiring());
    },
  });
  timeline.mark('CP0_SETUP_EXIT');

  const { kernel, moduleHub, callbackScope } = inst;
  const { lifecycle, run } = kernel;

  const facades = moduleHub.getFacades();
  const propsFacade = facades['props'] as PropsFacade<P>;
  const rulePort = moduleHub.getPort<RulePort<P>>('rule');

  const propsPort = moduleHub.getPort<PropsPort<P>>('props');
  if (!propsPort) {
    throw new Error('props port not found');
  }

  // initial props hydration (before any callbacks + before initial render)
  propsPort.applyRaw({ ...(host.getRawProps?.() ?? {}) });

  let ended = false;
  let updateInFlight = false;
  let updateQueued = false;
  const pendingDelayTasks = new Set<{ cancel(): void }>();

  const cancelPendingDelayTasks = () => {
    for (const task of pendingDelayTasks) {
      task.cancel();
    }
    pendingDelayTasks.clear();
  };

  callbackScope.setDelayContext({
    prototypeName: host.prototypeName,
    scheduleDelay(durationMs, callback) {
      if (!host.scheduleDelay) {
        throw new Error(
          `[Delay] host scheduler is not available for ${host.prototypeName}. Provide RuntimeHost.scheduleDelay.`
        );
      }

      let active = true;
      let hostCancel: (() => void) | undefined;

      const task = {
        cancel() {
          if (!active) return;
          active = false;
          pendingDelayTasks.delete(task);
          hostCancel?.();
        },
      };

      const invoke = () => {
        if (!active) return;
        active = false;
        pendingDelayTasks.delete(task);
        if (ended) return;
        callbackScope.run(run, callback);
      };

      const hostTask = host.scheduleDelay(durationMs, invoke);

      hostCancel = () => hostTask.cancel();
      pendingDelayTasks.add(task);

      return task;
    },
  });

  const doRenderCommit = (kind: 'initial' | 'update', onCommitted?: () => void) => {
    // pull latest raw before rendering
    propsPort.syncFromHost();

    const children = inst.renderOnce();
    timeline.mark(kind === 'initial' ? 'CP2_LOGICAL_TREE_READY' : 'CP6_UPDATE_RENDER');

    if (kind === 'initial') {
      timeline.mark('CP3_COMMIT_START');
    }

    let commitDone = false;
    const afterCommit = () => {
      if (commitDone) return;
      commitDone = true;
      if (ended) return;

      timeline.mark(kind === 'initial' ? 'CP4_COMMIT_DONE' : 'CP7_UPDATE_COMMIT_DONE');

      // bind event dispatch
      const eventPort = moduleHub.getPort<EventPort>('event');
      const eventRegistry = (moduleHub as any)[__RT_EVENT_CALLBACKS] as
        | { dispatch: (run: RunHandle<P>, id: string, ev: any) => void }
        | undefined;

      if (eventPort?.bind) {
        const dispatch = (id: string, ev: any) => {
          callbackScope.run(run, () => {
            eventPort.dispatchInternal?.(id, ev);
            eventRegistry?.dispatch(run, id, ev);
          });
        };
        eventPort.bind(dispatch);
      }

      moduleHub.afterRenderCommit();

      if (kind === 'update') {
        moduleHub.setProtoPhase('updated');
        timeline.mark('CP8_UPDATED_CALLBACKS');
        // updated callbacks
        callbackScope.run(run, () => {
          for (const cb of lifecycle.updated) cb(run);
        });
      }

      onCommitted?.();
    };

    host.commit(children, { done: afterCommit });

    return children;
  };

  let controller!: RuntimeController;

  const startUpdate = () => {
    updateInFlight = true;

    try {
      doRenderCommit('update', () => {
        updateInFlight = false;

        if (!updateQueued || ended) {
          updateQueued = false;
          return;
        }

        updateQueued = false;
        startUpdate();
      });
    } catch (error) {
      updateInFlight = false;
      updateQueued = false;
      throw error;
    }
  };

  const evaluateRuleStyle = () => {
    propsPort.syncFromHost();
    const current = propsFacade.get();
    if (!rulePort) return [];
    const res = rulePort.evaluate({ props: current });
    if (res.kind === 'plan' && res.plan.kind === 'style.tokens') {
      const tokens = res.plan.tokens;
      return tokens;
    }
    return [];
  };

  controller = {
    applyRawProps(nextRaw) {
      // must trigger watches but must NOT render/commit
      propsPort.applyRaw({ ...(nextRaw ?? {}) });
      callbackScope.runNoSync(run, () => {});
    },
    update() {
      if (ended) return;
      if (updateInFlight) {
        updateQueued = true;
        return;
      }
      startUpdate();
    },
    getRuleStyleTokens() {
      return evaluateRuleStyle();
    },
  };

  (run as any).update = () => controller.update();

  // created callbacks: once, before first commit
  timeline.mark('CP1_CREATED_CALLBACKS');
  callbackScope.run(run, () => {
    for (const cb of lifecycle.created) cb(run);
  });

  const presencePort = moduleHub.getPort<PresencePort>('presence');

  const finishMount = () => {
    if (ended) return;
    moduleHub.setProtoPhase('mounted');

    host.schedule(() => {
      if (ended) return;
      timeline.mark('CP5_MOUNTED_CALLBACKS');

      callbackScope.run(run, () => {
        for (const cb of lifecycle.mounted) cb(run);
      });
    });
  };

  // presence mount is async by design, but executeWithHost must stay sync
  // to avoid breaking adapter contracts across the monorepo. We defer the
  // mounted phase via .then() so it still waits for the mount approval.
  // initial commit
  const children = doRenderCommit('initial', () => {
    const mountPromise = presencePort?.awaitMount();
    if (mountPromise) {
      mountPromise.then(finishMount);
    } else {
      finishMount();
    }
  });

  const invokeUnmounted = async () => {
    if (ended) return;
    ended = true;
    cancelPendingDelayTasks();

    const unmountPromise = presencePort?.awaitUnmount();
    if (unmountPromise) {
      await unmountPromise;
    }

    timeline.mark('CP9_UNMOUNT_BEGIN');
    host.onUnmountBegin?.();

    const eventPort = moduleHub.getPort<EventPort>('event');
    eventPort?.unbind?.();
    const eventRegistry = (moduleHub as any)[__RT_EVENT_CALLBACKS] as
      | { clear: () => void }
      | undefined;
    eventRegistry?.clear?.();

    callbackScope.run(run, () => {
      for (const cb of lifecycle.unmounted) cb(run);
    });

    moduleHub.setProtoPhase('unmounted');
    inst.dispose();
    cancelPendingDelayTasks();
    timeline.mark('CP10_DISPOSE_COMPLETE');
  };

  return {
    children,
    controller,
    invokeUnmounted,
    caps: moduleHub,
    invokeInCallbackScope: (fn) => callbackScope.run(run, fn),
    kernel: inst.kernel,
  };
}
