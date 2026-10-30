import type { RuntimeHost } from '@proto.ui/runtime';
import { withWebComponentOwnedRelocation } from '../owned-relocation';
import { createWebOwnedDecorationPortalGate } from '@proto.ui/adapter-base';
import { equalOwnedTemplateBlueprint, type InstanceAssociations } from '@proto.ui/core';
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
  shadowViewTarget?: ShadowInnerSurface;
  schedule: (task: () => void) => void;
  rawPropsSource: RawPropsSource<Props>;
  getInstanceAssociations?: () => InstanceAssociations;
  viewOperations?: RuntimeHost<Props>['viewOperations'];
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
  let commitTurn = 0;
  let decorationCommit: {
    blueprint: TemplateChildren;
    lease: object;
    document: Document;
    nodes: Array<{ node: Node; parent: Node | null; decoration: boolean }>;
  } | null = null;
  const currentFeedback = () =>
    capsHub?.getPort?.('feedback') as import('@proto.ui/module-feedback').FeedbackPort | undefined;

  let portalDecorationGate: ReturnType<typeof createWebOwnedDecorationPortalGate> | null = null;
  // Stage split Template output without replacing owner-lived Shadow nodes.
  // Reuse the staging root; its live child list needs no intermediate copy.
  const shadowCommitRoot =
    shadowViewTarget && !textControlTarget ? root.ownerDocument.createDocumentFragment() : null;

  const commitWebComponentChildren = (children: TemplateChildren) => {
    const turn = ++commitTurn;
    if (decorationCommit) {
      const record = decorationCommit;
      if (
        currentFeedback()?.captureDecorationLease?.() !== record.lease ||
        root.ownerDocument !== record.document ||
        !root.isConnected
      )
        throw new Error('[WC Adapter] stale decoration blueprint lease');
      if (!equalOwnedTemplateBlueprint(record.blueprint, children))
        throw new Error('[feedback] decoration structural rebind unsupported');
      for (const { node, parent, decoration } of record.nodes) {
        if (
          node.ownerDocument !== record.document ||
          node.parentNode !== parent ||
          !root.contains(node)
        )
          throw new Error('[WC Adapter] decoration physical blueprint changed');
        if (decoration) {
          const leaf = node as HTMLElement;
          if (
            leaf.childNodes.length ||
            leaf.hasAttribute('tabindex') ||
            leaf.hasAttribute('contenteditable') ||
            !leaf.hasAttribute('data-pui-owned-decoration') ||
            leaf.getAttribute('aria-hidden') !== 'true' ||
            !leaf.hasAttribute('inert') ||
            leaf.style.getPropertyValue('pointer-events') !== 'none' ||
            leaf.style.getPropertyPriority('pointer-events') !== 'important'
          )
            throw new Error('[WC Adapter] decoration physical leaf changed');
        }
      }
      portalDecorationGate?.assertReusable();
      if (
        turn !== commitTurn ||
        decorationCommit !== record ||
        !root.isConnected ||
        root.ownerDocument !== record.document ||
        currentFeedback()?.captureDecorationLease?.() !== record.lease
      )
        throw new Error('[WC Adapter] decoration reuse superseded');
      return;
    }

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
        const slotPool = projector.collectSlotPoolBeforeCommit({ detach: false });
        withWebComponentOwnedRelocation(slotPool, root, () => root.replaceChildren(...slotPool));
      }
    } else {
      const projector = getSlotProjector() ?? ensureSlotProjector();
      const slotPool = projector.collectSlotPoolBeforeCommit({ detach: false });
      const owned = new WeakSet<Node>();
      let boundLease: object | undefined;

      const result = commitChildren(root, children, {
        mode: 'light',
        slotPool,
        owned,
        bindDecorations: (() => {
          const feedback = capsHub?.getPort?.('feedback') as
            | import('@proto.ui/module-feedback').FeedbackPort
            | undefined;
          const lease = feedback?.captureDecorationLease?.();
          return (bindings) => {
            const overlay = capsHub?.getPort?.('overlay') as
              | import('@proto.ui/module-overlay').OverlayPort
              | undefined;
            const gate =
              bindings.length && overlay?.getConfig().portal
                ? createWebOwnedDecorationPortalGate(root as HTMLElement, () => {
                    try {
                      return feedback?.captureDecorationLease?.() === lease;
                    } catch {
                      return false;
                    }
                  })
                : null;
            try {
              if (feedback?.bindDecorations)
                feedback.bindDecorations(
                  gate
                    ? bindings.map((binding) => ({
                        target: binding.target,
                        sink: gate.wrap(binding.sink),
                      }))
                    : bindings,
                  lease!
                );
              else if (bindings.length)
                throw new Error('[WC Adapter] owned-decoration binding unavailable');
              portalDecorationGate?.dispose();
              portalDecorationGate = gate;
              if (bindings.length) boundLease = lease;
            } catch (error) {
              gate?.dispose();
              throw error;
            }
          };
        })(),
      });

      // Preserve the established no-slot parking contract, but only after
      // staging and commit have succeeded. Rejected blueprints keep live nodes.
      if (!result.hasSlot) for (const node of slotPool) node.parentNode?.removeChild(node);

      projector.afterCommit({
        owned,
        slotStart: result.slotStart,
        slotEnd: result.slotEnd,
        projected: slotPool,
        enableMO: result.hasSlot,
      });
      if (boundLease) {
        if (currentFeedback()?.captureDecorationLease?.() !== boundLease)
          throw new Error('[WC Adapter] decoration lease changed during commit');
        const nodes: Array<{ node: Node; parent: Node | null; decoration: boolean }> = [];
        const collect = (parent: Node) => {
          for (const node of Array.from(parent.childNodes)) {
            if (!owned.has(node)) continue;
            nodes.push({
              node,
              parent: node.parentNode,
              decoration:
                node.nodeType === 1 && (node as Element).hasAttribute('data-pui-owned-decoration'),
            });
            collect(node);
          }
        };
        collect(root);
        if (
          turn !== commitTurn ||
          !root.isConnected ||
          currentFeedback()?.captureDecorationLease?.() !== boundLease
        )
          throw new Error('[WC Adapter] decoration commit superseded');
        decorationCommit = {
          blueprint: children,
          lease: boundLease,
          document: root.ownerDocument,
          nodes,
        };
      }
      return;
    }
    clearSlotProjector();
  };

  const hostSession = createAdapterHost(
    { ...proto, name: tagName },
    {
      getRawProps: () => rawPropsSource.get() as Readonly<Props & PropsBaseType>,
      getInstanceAssociations: args.getInstanceAssociations,
      viewOperations: args.viewOperations,
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
        commitTurn++;
        decorationCommit = null;
        portalDecorationGate?.dispose();
        portalDecorationGate = null;
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
    { initialMount: 'manual' }
  );

  capsHub = hostSession.caps;
  if (initialMount !== 'manual') void hostSession.mount();
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
