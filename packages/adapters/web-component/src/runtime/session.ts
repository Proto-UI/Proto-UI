import { createAdapterHost, createHostWiring } from '@proto.ui/adapter-base';
import type { Prototype, TemplateChildren } from '@proto.ui/core';
import { type RawPropsSource } from '@proto.ui/module-props';
import type { RuntimeCheckpoint, RuntimeLifecycleEvent } from '@proto.ui/runtime';
import { type PropsBaseType } from '@proto.ui/types';

import { commitChildren } from '../commit';
import { SlotProjector } from '../slot-projector';
import type { ShadowOwnerShell } from '../shadow-owner-shell';

type ShadowViewTarget = Pick<ShadowOwnerShell, 'replaceRenderedChildren' | 'hasOnlyRenderedNode'>;

export function createWebComponentHostSession<Props extends PropsBaseType>(args: {
  proto: Prototype<Props>;
  tagName: string;
  shadow: boolean;
  host: HTMLElement;
  root: Element | ShadowRoot;
  /** Private split pilot seam; owner resources are never Template commit targets. */
  shadowViewTarget?: ShadowViewTarget;
  schedule: (task: () => void) => void;
  rawPropsSource: RawPropsSource<Props>;
  textControlTarget: HTMLElement | null;
  imageViewTarget: HTMLImageElement | null;
  wiring: ReturnType<typeof createHostWiring>;
  eventGate: {
    enable(): void;
    disable(): void;
    dispose(): void;
  };
  router: {
    dispose(): void;
  };
  onLifecycleCheckpoint?: (cp: RuntimeCheckpoint) => void;
  onLifecycleEvent?: (event: RuntimeLifecycleEvent) => void;
  getSlotProjector: () => SlotProjector | null;
  ensureSlotProjector: () => SlotProjector;
  clearSlotProjector: () => void;
  onAfterUnmount?: () => void;
  initialMount?: 'eager' | 'manual';
}): ReturnType<typeof createAdapterHost<Props>> & { host: HTMLElement } {
  const {
    proto,
    tagName,
    shadow,
    host,
    root,
    shadowViewTarget,
    schedule,
    rawPropsSource,
    wiring,
    textControlTarget,
    imageViewTarget,
    eventGate,
    router,
    onLifecycleCheckpoint,
    onLifecycleEvent,
    getSlotProjector,
    ensureSlotProjector,
    clearSlotProjector,
    onAfterUnmount,
    initialMount,
  } = args;

  let capsHub: any = null;

  const commitWebComponentChildren = (children: TemplateChildren) => {
    const fixedTarget = textControlTarget ?? imageViewTarget;
    if (fixedTarget) {
      if (Array.isArray(children) ? children.length > 0 : children != null)
        throw new Error('host-target:children');
      if (shadowViewTarget) {
        if (!shadowViewTarget.hasOnlyRenderedNode(fixedTarget))
          shadowViewTarget.replaceRenderedChildren([fixedTarget]);
      } else if (root.firstChild !== fixedTarget || root.childNodes.length !== 1) {
        root.replaceChildren(fixedTarget);
      }
      clearSlotProjector();
      eventGate.enable();
      return;
    }

    if (shadow) {
      const staging = root.ownerDocument.createDocumentFragment();
      commitChildren(staging, children, { mode: 'shadow' });
      if (shadowViewTarget) shadowViewTarget.replaceRenderedChildren([...staging.childNodes]);
      else root.replaceChildren(...staging.childNodes);
      clearSlotProjector();
      eventGate.enable();
      return;
    }

    const only = Array.isArray(children) ? (children.length === 1 ? children[0] : null) : children;
    const onlyType = only && typeof only === 'object' ? (only as any).type : null;
    if (onlyType && typeof onlyType === 'object' && onlyType.kind === 'slot') {
      clearSlotProjector();
      eventGate.enable();
      return;
    }

    const projector = getSlotProjector() ?? ensureSlotProjector();
    const slotPool = projector.collectSlotPoolBeforeCommit();
    const owned = new WeakSet<Node>();
    const result = commitChildren(root as any, children, { mode: 'light', slotPool, owned });
    projector.afterCommit({
      owned,
      slotStart: result.slotStart,
      slotEnd: result.slotEnd,
      projected: slotPool,
      enableMO: result.hasSlot,
    });
    eventGate.enable();
  };

  const hostSession = createAdapterHost(
    { ...proto, name: tagName },
    {
      getRawProps: () => rawPropsSource.get() as Readonly<Props & PropsBaseType>,
      schedule,
      onLifecycleCheckpoint,
      onLifecycleEvent,
      commit: (children, signal) => {
        commitWebComponentChildren(children);
        signal?.done();
      },
    },
    {
      onRuntimeReady: (wiringApi) => {
        wiring.onRuntimeReady(wiringApi);
      },
      onUnmountBegin: () => {
        eventGate.disable();
      },
      afterUnmount: () => {
        try {
          const port = (capsHub as any).getPort?.('test-sys');
          port?.trace?.('after-unmount');
        } catch {}

        wiring.afterUnmount();
        eventGate.dispose();
        router.dispose();
        clearSlotProjector();
        onAfterUnmount?.();
      },
    },
    { initialMount }
  );

  capsHub = hostSession.caps;
  return { ...hostSession, host };
}
