import { createAdapterHost, createHostWiring } from '@proto.ui/adapter-base';
import type { Prototype, TemplateChildren } from '@proto.ui/core';
import { type RawPropsSource } from '@proto.ui/module-props';
import type { RuntimeCheckpoint, RuntimeLifecycleEvent } from '@proto.ui/runtime';
import { type PropsBaseType } from '@proto.ui/types';

import { commitChildren } from '../commit';
import { SlotProjector } from '../slot-projector';
import type { ShadowInnerSurface } from '../shadow-inner-surface';

export function createWebComponentHostSession<Props extends PropsBaseType>(args: {
  proto: Prototype<Props>;
  tagName: string;
  shadow: boolean;
  host: HTMLElement;
  root: Element | ShadowRoot;
  schedule: (task: () => void) => void;
  rawPropsSource: RawPropsSource<Props>;
  textControlTarget: HTMLElement | null;
  imageViewTarget: HTMLImageElement | null;
  shadowViewTarget?: ShadowInnerSurface | null;
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
    schedule,
    rawPropsSource,
    wiring,
    textControlTarget,
    imageViewTarget,
    shadowViewTarget,
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
  // Stage split Template output without replacing owner-lived Shadow nodes.
  // Reuse the staging root; its live child list needs no intermediate copy.
  const shadowCommitRoot =
    shadowViewTarget && !textControlTarget ? root.ownerDocument.createDocumentFragment() : null;

  const commitWebComponentChildren = (children: TemplateChildren) => {
    const nativeTarget = textControlTarget ?? imageViewTarget;
    if (nativeTarget) {
      const hasChildren = Array.isArray(children) ? children.length > 0 : children != null;
      if (hasChildren) {
        const role = textControlTarget ? 'text-control' : 'image-view';
        throw new Error(`[WC Adapter] ${role} prototypes must return empty Template children.`);
      }
      if (textControlTarget && shadowViewTarget) {
        if (!shadowViewTarget.hasOnlyRenderedNode(nativeTarget))
          shadowViewTarget.replaceRenderedChildren([nativeTarget]);
      } else if (root.firstChild !== nativeTarget || root.childNodes.length !== 1) {
        root.replaceChildren(nativeTarget);
      }
    } else if (shadow) {
      commitChildren(shadowCommitRoot ?? root, children, { mode: 'shadow' });
      if (shadowCommitRoot) shadowViewTarget!.replaceRenderedChildren(shadowCommitRoot.childNodes);
    } else if (isSlotOnly(children)) {
      const projector = getSlotProjector();
      if (projector) {
        // Preserve caller nodes before dropping the previous owned-node boundary.
        // An initial slot-only view has no projector and leaves its children alone.
        const slotPool = projector.collectSlotPoolBeforeCommit();
        root.replaceChildren(...slotPool);
      }
    } else {
      const projector = getSlotProjector() ?? ensureSlotProjector();
      const slotPool = projector.collectSlotPoolBeforeCommit();
      const owned = new WeakSet<Node>();

      const result = commitChildren(root, children, {
        mode: 'light',
        slotPool,
        owned,
      });

      projector.afterCommit({
        owned,
        slotStart: result.slotStart,
        slotEnd: result.slotEnd,
        projected: slotPool,
        enableMO: result.hasSlot,
      });
      return;
    }
    clearSlotProjector();
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
        eventGate.enable();
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

        // A readiness observer may throw while the view is released. Complete
        // the session tail too, preserving the original disposal failure.
        completeCleanup([
          () => wiring.afterUnmount(),
          () => eventGate.dispose(),
          () => router.dispose(),
          clearSlotProjector,
          () => onAfterUnmount?.(),
        ]);
      },
    },
    { initialMount }
  );

  capsHub = hostSession.caps;
  return { ...hostSession, host };
}

// WC-internal release fanout follows the acquired-owner convention in adapter-base.
// Track failure separately: JavaScript permits throwing undefined.
export function completeCleanup(steps: Array<() => void>): void {
  let failed = false;
  let firstError: unknown;
  for (const step of steps) {
    try {
      step();
    } catch (error) {
      if (!failed) {
        failed = true;
        firstError = error;
      }
    }
  }
  if (failed) throw firstError;
}

function isSlotOnly(children: TemplateChildren): boolean {
  if (children == null) return false;

  const one = Array.isArray(children) ? (children.length === 1 ? children[0] : null) : children;
  if (!one || typeof one !== 'object') return false;

  const type = (one as any).type;
  return !!type && typeof type === 'object' && type.kind === 'slot';
}
