import { defineAsHook, definePrototype, tw, type DefHandle } from '@proto.ui/core';
import { asAccessible, asBoundary, asFocusScope, asOverlay } from '@proto.ui/hooks';
import { asTransition } from '../tools';
import {
  POPOVER_CONTEXT,
  POPOVER_FAMILY,
  createPopoverPartId,
  requestPopoverOpen,
  type PopoverContextValue,
  type PopoverOpenFocusReason,
} from './shared';
import type {
  PopoverContentAsHookContract,
  PopoverContentExposes,
  PopoverContentHandles,
  PopoverContentProps,
} from './types';

function projectPopoverContentHandle(
  result: import('@proto.ui/core').AsHookResult<PopoverContentProps, PopoverContentAsHookContract>
): PopoverContentHandles {
  // C-AS-HOOK-0009-E, C-AS-HOOK-0009-F: selectively re-export Transition's
  // stable child handle without flattening its state into Popover Content.
  const open = result.getState?.('open');
  const asTransition = result.getAsHookHandle?.('asTransition');
  if (!open || !asTransition) {
    throw new Error('[as-popover-content] missing captured Popover or Transition handles.');
  }
  return { stateHandles: { open }, asTransition };
}

function setupPopoverContent(def: DefHandle<PopoverContentProps, PopoverContentExposes>): void {
  const accessible = asAccessible();

  def.anatomy.claim(POPOVER_FAMILY, { role: 'content' });

  const alertProp = def.state.bool('alert', false);
  const role = def.state.string('popoverRole', 'dialog', {
    options: ['dialog', 'alertdialog'],
  });
  const modal = def.state.bool('popoverModal', false);
  const contentId = def.state.string('popoverContentId', '');
  const accessibleLabel = def.state.string('popoverAccessibleLabel', '');
  const labelledBy = def.state.string('popoverLabelledBy', '');
  const describedBy = def.state.string('popoverDescribedBy', '');

  accessible.id(contentId);
  accessible.role(role);
  accessible.name(accessibleLabel);
  accessible.state('modal', modal);
  accessible.relation('labelledBy', { target: labelledBy });
  accessible.relation('describedBy', { target: describedBy });

  const overlay = asOverlay<PopoverContentProps>();
  overlay.configure({
    closeOnEscape: true,
    closeOnOutsidePress: false,
    closeOnFocusOutside: false,
    restore: 'none',
    entry: 'content',
    anchored: true,
    placement: 'bottom',
    align: 'center',
    sideOffset: 4,
    avoidCollisions: true,
    collisionBoundary: 'clippingAncestors',
    strategy: 'fixed',
    portal: true,
    modal: false,
    layerRole: 'popover-content',
  });

  const boundary = asBoundary();
  boundary.observe('pointer.press');

  const focusScope = asFocusScope<PopoverContentProps>();
  focusScope.configure({ trap: false, loop: false, restore: 'none' });

  const transition = asTransition();
  overlay.bindPresence({
    enter: transition.controls.enter,
    leave: transition.controls.leave,
    present: transition.isPresent,
  });

  def.props.define({
    side: { type: 'string', empty: 'fallback' },
    align: { type: 'string', empty: 'fallback' },
    sideOffset: { type: 'number', empty: 'fallback' },
    alignOffset: { type: 'number', empty: 'fallback' },
    collisionPadding: { type: 'number', empty: 'fallback' },
  });
  def.props.setDefaults({
    side: 'bottom',
    align: 'center',
    sideOffset: 4,
    alignOffset: 0,
    collisionPadding: 8,
  });
  const syncPosition = (run: any) => {
    const p = run.props.get();
    overlay.updatePosition({
      placement: p.side,
      align: p.align,
      sideOffset: p.sideOffset,
      alignOffset: p.alignOffset,
      collisionPadding: p.collisionPadding,
    });
  };
  def.props.watch(['side', 'align', 'sideOffset', 'alignOffset', 'collisionPadding'], syncPosition);
  const open = def.state.bool('open', false);
  def.expose.state('open', open);

  let mountedRun: any = null;
  let currentContext: PopoverContextValue | null = null;
  let warnedMissingAlertDescription = false;

  const hasLivePart = (run: any, role: 'title' | 'description'): boolean => {
    try {
      return run.anatomy.has(POPOVER_FAMILY, role);
    } catch (error) {
      if ((error as { code?: string })?.code === 'ANATOMY_CLAIM_INVALID') return false;
      throw error;
    }
  };

  const syncA11yRelations = (run: any, ctx: PopoverContextValue) => {
    const hasTitle = hasLivePart(run, 'title');
    const hasDescription = hasLivePart(run, 'description');
    labelledBy.set(
      hasTitle ? createPopoverPartId(ctx.rootId, 'title') : '',
      'reason: popover live title relation sync'
    );
    accessibleLabel.set(
      hasTitle ? '' : ctx.a11yLabel,
      'reason: popover accessible label fallback sync'
    );
    describedBy.set(
      hasDescription ? createPopoverPartId(ctx.rootId, 'description') : '',
      'reason: popover live description relation sync'
    );

    if (!mountedRun || !ctx.alert || hasDescription) {
      warnedMissingAlertDescription = false;
      return;
    }
    if (warnedMissingAlertDescription) return;
    warnedMissingAlertDescription = true;
    console.warn(
      '[base-popover-content] Alert Popover requires a Popover Description containing its primary message.'
    );
  };

  def.anatomy.subscribeParts(POPOVER_FAMILY, 'title', (run) => {
    if (currentContext) syncA11yRelations(run, currentContext);
  });
  def.anatomy.subscribeParts(POPOVER_FAMILY, 'description', (run) => {
    if (currentContext) syncA11yRelations(run, currentContext);
  });

  const updateOpen = (
    nextOpen: boolean,
    reason?: string,
    options?: { focusReason?: PopoverOpenFocusReason | null }
  ) => {
    const prevOpen = open.get();
    open.set(nextOpen, reason ?? 'reason: popover content sync => open');
    if (nextOpen) {
      overlay.openOverlay(reason ?? 'popover.open');
    } else {
      overlay.close(reason ?? 'popover.close');
    }
    // Context remains live while the L1 view is detached. Structural intent
    // is driven by Transition below, but overlay/focus effects require a
    // mounted view and must not be consumed early by the retained instance.
    if (!mountedRun) return;
    if (nextOpen) {
      if (!prevOpen || !focusScope.isActive()) {
        focusScope.activate({ reason: options?.focusReason ?? 'programmatic' });
      }
    } else {
      if (prevOpen) {
        focusScope.deactivate({ reason: options?.focusReason ?? 'programmatic' });
        if (!['outside.press', 'focus.outside'].includes(currentContext?.requestReason ?? '')) {
          const trigger = mountedRun.anatomy.partsOf(POPOVER_FAMILY, 'trigger')[0];
          const focus = trigger?.getExpose('focusSelf');
          if (typeof focus === 'function')
            focus({ reason: options?.focusReason ?? 'programmatic' });
        }
      }
    }
  };

  const syncIdentity = (ctx: PopoverContextValue) => {
    contentId.set(createPopoverPartId(ctx.rootId, 'content'), 'reason: popover content id sync');
  };

  const syncAlert = (ctx: PopoverContextValue) => {
    const alert = ctx.alert;
    alertProp.set(alert, 'reason: popover alert sync');
    role.set(alert ? 'alertdialog' : 'dialog', 'reason: popover semantic role sync');
  };

  def.context.subscribe(POPOVER_CONTEXT, (run, next) => {
    currentContext = next;
    syncIdentity(next);
    syncAlert(next);
    syncA11yRelations(run, next);
    updateOpen(next.open, 'reason: popover context sync => content', {
      focusReason: next.open ? next.openFocusReason : next.returnFocusReason,
    });
  });

  def.lifecycle.onCreated((run) => {
    syncPosition(run);
    const ctx = run.context.read(POPOVER_CONTEXT);
    currentContext = ctx;
    syncIdentity(ctx);
    syncAlert(ctx);
    syncA11yRelations(run, ctx);
    updateOpen(ctx.open, 'reason: lifecycle.onCreated => popover content open sync', {
      focusReason: ctx.open ? ctx.openFocusReason : ctx.returnFocusReason,
    });
  });

  def.lifecycle.onMounted((run) => {
    mountedRun = run;
    const anchor = run.anatomy.partsOf(POPOVER_FAMILY, 'trigger')[0];
    if (anchor) overlay.registerAnchorPart(anchor);
    syncPosition(run);
    syncPosition(run);
    const ctx = run.context.read(POPOVER_CONTEXT);
    currentContext = ctx;
    syncIdentity(ctx);
    syncAlert(ctx);
    syncA11yRelations(run, ctx);
    updateOpen(ctx.open, 'reason: lifecycle.onMounted => popover content open sync', {
      focusReason: ctx.open ? ctx.openFocusReason : ctx.returnFocusReason,
    });
  });

  def.lifecycle.onUnmounted(() => {
    mountedRun = null;
    currentContext = null;
  });

  overlay.open.watch((_ctx, event) => {
    if (event.type !== 'next' || event.next || event.reason !== 'escape') return;
    const run = mountedRun;
    if (!run) return;
    const ctx = currentContext;
    if (!ctx) return;
    if (!ctx.open) return;
    requestPopoverOpen(run, false, 'escape', 'keyboard');
    // Request delivery may synchronously replace the owner's open input.
    // Restore only a still-open controlled fact, never the pre-request snapshot.
    if (currentContext?.controlled && currentContext.open) overlay.openOverlay('controlled.sync');
  });

  boundary.subscribeOutside(() => {
    if (!overlay.isOpen()) return;
    const returnFocusReason: PopoverOpenFocusReason = 'pointer';
    const run = mountedRun;
    if (!run) return;
    const ctx = currentContext;
    if (!ctx) return;
    if (!ctx.open) return;
    if (alertProp.get()) return;

    requestPopoverOpen(run, false, 'outside.press', returnFocusReason);
  });

  focusScope.hasFocused.watch((run, event) => {
    if (event.type !== 'next' || event.next || !open.get() || !mountedRun) return;
    requestPopoverOpen(run, false, 'focus.outside', 'keyboard');
  });

  def.rule({
    when: (w) => w.state(transition.isPresent).eq(false),
    intent: (i) => i.feedback.style.use(tw('hidden')),
  });
}

export const asPopoverContent = defineAsHook<
  PopoverContentProps,
  PopoverContentExposes,
  PopoverContentAsHookContract,
  PopoverContentHandles
>({
  name: 'as-popover-content',
  setup: setupPopoverContent,
  projectHandle: projectPopoverContentHandle,
});

const popoverContent = definePrototype({
  name: 'base-popover-content',
  setup(def) {
    setupPopoverContent(def);
    def.feedback.style.use(
      tw(
        'z-50 max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-y-auto'
      )
    );
  },
});

export default popoverContent;
