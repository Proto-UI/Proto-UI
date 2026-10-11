import { defineAsHook, definePrototype, tw, type DefHandle } from '@proto.ui/core';
import { asOverlay } from '@proto.ui/hooks';
import { asTransition } from '../tools';
import { HOVER_CARD_CONTEXT, HOVER_CARD_FAMILY, createHoverCardInteraction } from './shared';
import type {
  HoverCardContentAsHookContract,
  HoverCardContentExposes,
  HoverCardContentHandles,
  HoverCardContentProps,
} from './types';

function projectHoverCardContentHandle(
  result: import('@proto.ui/core').AsHookResult<
    HoverCardContentProps,
    HoverCardContentAsHookContract
  >
): HoverCardContentHandles {
  const open = result.getState?.('open');
  const asTransition = result.getAsHookHandle?.('asTransition');
  if (!open || !asTransition) {
    throw new Error('[as-hover-card-content] missing captured Hover Card or Transition handles.');
  }
  return { stateHandles: { open }, asTransition };
}

function setupHoverCardContent(
  def: DefHandle<HoverCardContentProps, HoverCardContentExposes>
): void {
  // P-BASE-HOVER-CARD-CONTENT-SURFACE
  def.anatomy.claim(HOVER_CARD_FAMILY, { role: 'content' });
  def.props.define({
    side: {
      type: 'enum',
      empty: 'fallback',
      options: ['top', 'right', 'bottom', 'left'],
    },
    align: {
      type: 'enum',
      empty: 'fallback',
      options: ['start', 'center', 'end'],
    },
    sideOffset: { type: 'number', empty: 'fallback' },
    alignOffset: { type: 'number', empty: 'fallback' },
    avoidCollisions: { type: 'boolean', empty: 'fallback' },
    collisionPadding: { type: 'number', empty: 'fallback' },
  });
  def.props.setDefaults({
    side: 'bottom',
    align: 'center',
    sideOffset: 4,
    alignOffset: 0,
    avoidCollisions: true,
    collisionPadding: 0,
  });

  // P-BASE-HOVER-CARD-CONTENT-OVERLAY
  const overlay = asOverlay<HoverCardContentProps>();
  overlay.configure({
    closeOnEscape: false,
    closeOnOutsidePress: false,
    closeOnFocusOutside: false,
    restore: 'none',
    entry: 'manual',
    placement: 'bottom',
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
    layerRole: 'hover-card-content',
    meta: { overlayKind: 'hover-card' },
  });

  // P-BASE-HOVER-CARD-CONTENT-PRESENCE
  const transition = asTransition();
  overlay.bindPresence({
    enter: transition.controls.enter,
    leave: transition.controls.leave,
    present: transition.isPresent,
  });

  const open = def.state.bool('open', false);
  const hovered = def.state.bool('hovered', false);
  const interaction = createHoverCardInteraction('content');
  def.expose.state('open', open);

  const updateOpen = (nextOpen: boolean, reason: string) => {
    open.set(nextOpen, reason);
    if (nextOpen) overlay.openOverlay(reason);
    else overlay.close(reason);
  };

  const syncPosition = (run: any) => {
    // P-BASE-HOVER-CARD-CONTENT-POSITION, P-BASE-HOVER-CARD-CONTENT-COLLISION
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

  def.props.watch(
    ['side', 'align', 'sideOffset', 'alignOffset', 'avoidCollisions', 'collisionPadding'],
    (run) => syncPosition(run)
  );

  def.context.subscribe(HOVER_CARD_CONTEXT, (_run, next) => {
    updateOpen(next.open, 'reason: hover-card context sync => content open');
  });
  def.lifecycle.onCreated((run) => {
    syncPosition(run);
    const ctx = run.context.read(HOVER_CARD_CONTEXT);
    updateOpen(ctx.open, 'reason: lifecycle.onCreated => hover-card content open sync');
  });
  def.lifecycle.onMounted((run) => {
    interaction.mount(run);
    // P-BASE-HOVER-CARD-CONTENT-ANCHOR, P-BASE-HOVER-CARD-CONTENT-PORTAL
    const trigger = run.anatomy.partsOf(HOVER_CARD_FAMILY, 'trigger')[0] ?? null;
    if (trigger) overlay.registerAnchorPart(trigger);
    syncPosition(run);
    const ctx = run.context.read(HOVER_CARD_CONTEXT);
    updateOpen(ctx.open, 'reason: lifecycle.onMounted => hover-card content open sync');
  });
  def.lifecycle.onUnmounted(() => {
    hovered.set(false, 'reason: hover-card content unmounted => hovered false');
    interaction.release();
  });

  def.lifecycle.onBeforeDispose(() => interaction.release());

  // P-BASE-HOVER-CARD-CONTENT-HOVER-BRIDGE
  def.event.on('pointer.enter', (run) => {
    hovered.set(true, 'reason: hover-card content pointer.enter');
    interaction.update(run, { contentHovered: true }, 'content.pointerenter');
  });
  def.event.on('pointer.leave', (run) => {
    hovered.set(false, 'reason: hover-card content pointer.leave');
    interaction.update(run, { contentHovered: false }, 'content.pointerleave');
  });

  def.rule({
    // P-BASE-HOVER-CARD-CONTENT-PRESENCE
    when: (w) => w.state(transition.isPresent).eq(false),
    intent: (i) => i.feedback.style.use(tw('hidden')),
  });
}

/*
 * P-BASE-HOVER-CARD-CONTENT-NON-MODAL: no focus scope, outside dismissal,
 * Escape dismissal, or dialog semantics are authored by Content.
 * P-BASE-HOVER-CARD-CONTENT-DEFERRED-EXTENSIONS: Arrow, forceMount, custom
 * collision boundary elements, sticky positioning, and detached-anchor hiding remain extensions.
 */

// P-BASE-HOVER-CARD-CONTENT-AUTHORING-ENTRIES
export const asHoverCardContent = defineAsHook<
  HoverCardContentProps,
  HoverCardContentExposes,
  HoverCardContentAsHookContract,
  HoverCardContentHandles
>({
  name: 'as-hover-card-content',
  setup: setupHoverCardContent,
  projectHandle: projectHoverCardContentHandle,
});

const hoverCardContent = definePrototype({
  name: 'base-hover-card-content',
  setup(def) {
    setupHoverCardContent(def);
    def.feedback.style.use(tw('absolute z-40'));
  },
});

export default hoverCardContent;
