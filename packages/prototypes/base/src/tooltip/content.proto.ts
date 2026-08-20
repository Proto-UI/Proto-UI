import { defineAsHook, definePrototype, tw, type DefHandle, type RunHandle } from '@proto.ui/core';
import { asOverlay } from '@proto.ui/hooks';
import { asTransition } from '../tools';
import {
  createTooltipContentId,
  dismissTooltipFromEscape,
  TOOLTIP_CONTEXT,
  TOOLTIP_FAMILY,
  TOOLTIP_GROUP_CONTEXT,
  updateTooltipInteraction,
  type TooltipContextValue,
} from './shared';
import type {
  TooltipContentAsHookContract,
  TooltipContentExposes,
  TooltipContentHandles,
  TooltipContentProps,
} from './types';

function projectTooltipContentHandle(
  result: import('@proto.ui/core').AsHookResult<TooltipContentProps, TooltipContentAsHookContract>
): TooltipContentHandles {
  const open = result.getState?.('open');
  const transition = result.getAsHookHandle?.('asTransition');
  if (!open || !transition) {
    throw new Error('[as-tooltip-content] missing captured Tooltip or Transition handles.');
  }
  return { stateHandles: { open }, asTransition: transition };
}

function setupTooltipContent(def: DefHandle<TooltipContentProps, TooltipContentExposes>): void {
  def.anatomy.claim(TOOLTIP_FAMILY, { role: 'content' });
  const contentId = def.state.string('tooltipContentId', '');
  def.a11y.id(contentId);
  def.a11y.role('tooltip');

  def.props.define({
    side: { type: 'enum', empty: 'fallback', options: ['top', 'right', 'bottom', 'left'] },
    align: { type: 'enum', empty: 'fallback', options: ['start', 'center', 'end'] },
    sideOffset: { type: 'number', empty: 'fallback' },
    alignOffset: { type: 'number', empty: 'fallback' },
    avoidCollisions: { type: 'boolean', empty: 'fallback' },
    collisionPadding: { type: 'number', empty: 'fallback' },
  });
  def.props.setDefaults({
    side: 'top',
    align: 'center',
    sideOffset: 4,
    alignOffset: 0,
    avoidCollisions: true,
    collisionPadding: 0,
  });

  const overlay = asOverlay<TooltipContentProps>();
  overlay.configure({
    closeOnEscape: true,
    closeOnOutsidePress: false,
    closeOnFocusOutside: false,
    restore: 'none',
    entry: 'manual',
    placement: 'top',
    align: 'center',
    sideOffset: 4,
    alignOffset: 0,
    anchored: true,
    strategy: 'fixed',
    avoidCollisions: true,
    collisionBoundary: 'clippingAncestors',
    collisionPadding: 0,
    portal: true,
    modal: false,
    layerRole: 'tooltip-content',
    meta: { overlayKind: 'tooltip' },
  });

  const transition = asTransition();
  overlay.bindPresence({
    enter: transition.controls.enter,
    leave: transition.controls.leave,
    present: transition.isPresent,
  });

  const open = def.state.bool('open', false);
  const hovered = def.state.bool('hovered', false);
  def.expose.state('open', open);

  const updateOpen = (nextOpen: boolean, reason: string) => {
    open.set(nextOpen, reason);
    if (nextOpen) overlay.openOverlay(reason);
    else overlay.close(reason);
  };

  const syncPosition = (run: RunHandle<TooltipContentProps>) => {
    const props = run.props.get();
    overlay.updatePosition({
      placement: props.side,
      align: props.align,
      sideOffset: props.sideOffset,
      alignOffset: props.alignOffset,
      avoidCollisions: props.avoidCollisions,
      collisionPadding: props.collisionPadding,
      strategy: 'fixed',
      collisionBoundary: 'clippingAncestors',
    });
  };

  const syncContext = (next: TooltipContextValue) => {
    contentId.set(createTooltipContentId(next.rootId), 'reason: tooltip content identity sync');
    updateOpen(next.open, 'reason: tooltip context sync');
  };

  def.props.watch(
    ['side', 'align', 'sideOffset', 'alignOffset', 'avoidCollisions', 'collisionPadding'],
    (run) => syncPosition(run)
  );
  def.context.subscribe(TOOLTIP_CONTEXT, (_run, next) => syncContext(next));
  def.context.trySubscribe(TOOLTIP_GROUP_CONTEXT, (run, group) => {
    if (!group) return;
    const incomingTooltipId =
      group.requestOpen && group.requestTooltipId ? group.requestTooltipId : group.activeTooltipId;
    const ctx = run.context.read(TOOLTIP_CONTEXT);
    // A sibling handoff is a replacement, not a normal dismissal. Root still
    // owns the logical close request; Content only removes an outgoing,
    // uncontrolled perceptual presence so a leave animation cannot overlap the
    // incoming Tooltip. Controlled open authority remains with the host.
    if (
      incomingTooltipId &&
      incomingTooltipId !== ctx.rootId &&
      !ctx.controlled &&
      transition.isPresent.get()
    ) {
      // Normalize both entering and entered states into leaving before
      // completing; complete() alone would finish an interrupted enter.
      transition.controls.leave();
      transition.controls.complete();
    }
  });

  const store: { run: RunHandle<TooltipContentProps> | null } = { run: null };
  def.lifecycle.onCreated((run) => {
    store.run = run;
    syncPosition(run);
    syncContext(run.context.read(TOOLTIP_CONTEXT));
  });
  def.lifecycle.onMounted((run) => {
    store.run = run;
    const trigger = run.anatomy.partsOf(TOOLTIP_FAMILY, 'trigger')[0] ?? null;
    if (trigger) overlay.registerAnchorPart(trigger);
    syncPosition(run);
    syncContext(run.context.read(TOOLTIP_CONTEXT));
  });
  def.lifecycle.onUnmounted(() => {
    store.run = null;
    hovered.set(false, 'reason: tooltip content unmounted');
  });

  overlay.open.watch((_run, event) => {
    if (event.type !== 'next' || event.next || event.reason !== 'escape') return;
    const run = store.run;
    if (!run) return;
    const ctx = run.context.read(TOOLTIP_CONTEXT);
    if (!ctx.open) return;
    dismissTooltipFromEscape(run);
    if (ctx.controlled) overlay.openOverlay('controlled.sync');
  });

  def.event.on('pointer.enter', (run) => {
    hovered.set(true, 'reason: tooltip content pointer.enter');
    updateTooltipInteraction(run, { contentHovered: true }, 'content.pointerenter');
  });
  def.event.on('pointer.leave', (run) => {
    hovered.set(false, 'reason: tooltip content pointer.leave');
    updateTooltipInteraction(run, { contentHovered: false }, 'content.pointerleave');
  });

  def.rule({
    when: (w) => w.state(transition.isPresent).eq(false),
    intent: (i) => i.feedback.style.use(tw('hidden')),
  });
}

export const asTooltipContent = defineAsHook<
  TooltipContentProps,
  TooltipContentExposes,
  TooltipContentAsHookContract,
  TooltipContentHandles
>({
  name: 'as-tooltip-content',
  setup: setupTooltipContent,
  projectHandle: projectTooltipContentHandle,
});

const tooltipContent = definePrototype<TooltipContentProps, TooltipContentExposes>({
  name: 'base-tooltip-content',
  setup(def) {
    setupTooltipContent(def);
    def.feedback.style.use(tw('absolute z-50'));
  },
});

export default tooltipContent;
