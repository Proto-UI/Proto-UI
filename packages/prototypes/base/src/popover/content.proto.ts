import { defineAsHook, definePrototype, tw, type DefHandle, type RunHandle } from '@proto.ui/core';
import { asAccessible, asBoundary, asFocusEntry, asFocusScope, asOverlay } from '@proto.ui/hooks';
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
  boundary.observe('focus.move');

  const focusEntry = asFocusEntry<PopoverContentProps>();
  focusEntry.configure({ strategy: 'descendant-first', fallback: 'self', disabled: true });
  const focusScope = asFocusScope<PopoverContentProps>();
  focusScope.configure({ trap: false, loop: false, restore: 'none', entryFallback: 'entry' });

  const transition = asTransition();
  transition.bindInitialOpen<PopoverContextValue>({ context: POPOVER_CONTEXT, field: 'open' });

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
  const syncPosition = (run: RunHandle<PopoverContentProps>) => {
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

  let mountedRun: RunHandle<PopoverContentProps> | null = null;
  let currentContext: PopoverContextValue | null = null;
  let warnedMissingAlertDescription = false;
  let openingEntryConsumed = false;
  let openUpdateVersion = 0;

  const hasLivePart = (
    run: RunHandle<PopoverContentProps>,
    role: 'title' | 'description'
  ): boolean => {
    try {
      return run.anatomy.has(POPOVER_FAMILY, role);
    } catch (error) {
      if ((error as { code?: string })?.code === 'ANATOMY_CLAIM_INVALID') return false;
      throw error;
    }
  };

  const syncA11yRelations = (run: RunHandle<PopoverContentProps>, ctx: PopoverContextValue) => {
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

  const isCurrentOpenUpdate = (
    run: RunHandle<PopoverContentProps>,
    version: number,
    ctx: PopoverContextValue
  ): boolean => {
    if (version !== openUpdateVersion) return false;
    // A provider update may be accepted while its subscriber delivery is still
    // serialized behind this callback. Read the current Root fact as well.
    const current = run.context.read(POPOVER_CONTEXT);
    return (
      current.rootId === ctx.rootId &&
      current.open === ctx.open &&
      current.requestVersion === ctx.requestVersion &&
      current.openFocusReason === ctx.openFocusReason &&
      current.returnFocusReason === ctx.returnFocusReason
    );
  };

  const updateOpen = (
    run: RunHandle<PopoverContentProps>,
    ctx: PopoverContextValue,
    reason?: string
  ) => {
    if (currentContext !== ctx) return;
    const version = ++openUpdateVersion;
    if (!isCurrentOpenUpdate(run, version, ctx)) return;
    const nextOpen = ctx.open;
    const focusReason = (nextOpen ? ctx.openFocusReason : ctx.returnFocusReason) ?? 'programmatic';
    const prevOpen = open.get();
    if (!nextOpen) openingEntryConsumed = false;
    open.set(nextOpen, reason ?? 'reason: popover content sync => open');
    if (!isCurrentOpenUpdate(run, version, ctx)) return;
    // Closed availability owns all Entry-role work. An outside request that
    // the controlled owner refuses cancels only its Scope activation below.
    focusEntry.setDisabled(!nextOpen);
    if (!isCurrentOpenUpdate(run, version, ctx)) return;
    if (!nextOpen) {
      // Logical cancellation is required even when the retained view is gone
      // or emptyPolicy left the public Scope boundary inactive. Complete it
      // before Overlay can synchronously release the closing physical view.
      focusScope.deactivate({ reason: focusReason });
      if (!isCurrentOpenUpdate(run, version, ctx)) return;
      const mounted = mountedRun;
      if (
        prevOpen &&
        mounted &&
        ctx.requestReason !== 'outside.press' &&
        ctx.requestReason !== 'focus.outside'
      ) {
        const trigger = mounted.anatomy.partsOf(POPOVER_FAMILY, 'trigger')[0];
        const focus = trigger?.getExpose('focusSelf');
        if (
          isCurrentOpenUpdate(run, version, ctx) &&
          mountedRun === mounted &&
          typeof focus === 'function'
        )
          focus({ reason: focusReason });
      }
      if (!isCurrentOpenUpdate(run, version, ctx)) return;
      overlay.close(reason ?? 'popover.close');
      return;
    }
    overlay.openOverlay(reason ?? 'popover.open');
    if (!isCurrentOpenUpdate(run, version, ctx)) return;
    // The first mounted view consumes this accepted opening. Focus alone owns
    // pending readiness across retained detach; inactive is not an entry result.
    if (!mountedRun || openingEntryConsumed) return;
    openingEntryConsumed = true;
    focusScope.activate({
      reason: focusReason,
      preventScroll: true,
    });
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
    updateOpen(run, next, 'reason: popover context sync => content');
  });

  def.lifecycle.onCreated((run) => {
    syncPosition(run);
    const ctx = run.context.read(POPOVER_CONTEXT);
    currentContext = ctx;
    syncIdentity(ctx);
    syncAlert(ctx);
    syncA11yRelations(run, ctx);
    updateOpen(run, ctx, 'reason: lifecycle.onCreated => popover content open sync');
  });

  // C-LIFECYCLE-0002-I: reconcile only after created has synchronized Root's
  // initial open into Overlay; an earlier reconciliation would drive stale false.
  overlay.bindPresence({
    enter: transition.controls.enter,
    leave: transition.controls.leave,
    present: transition.isPresent,
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
    updateOpen(run, ctx, 'reason: lifecycle.onMounted => popover content open sync');
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

  boundary.subscribeOutside((event) => {
    if (!overlay.isOpen()) return;
    const focusOutside = event.observation === 'focus.move';
    // A verified focus movement does not identify its input device. Do not
    // infer keyboard origin from focusin or inspect host events in the consumer.
    const returnFocusReason: PopoverOpenFocusReason = focusOutside ? 'programmatic' : 'pointer';
    const ctx = currentContext;
    if (!ctx) return;
    if (!ctx.open) return;
    if (alertProp.get()) return;

    const version = openUpdateVersion;
    const run = mountedRun;
    openingEntryConsumed = true;
    focusScope.deactivate({ reason: returnFocusReason });
    if (mountedRun !== run || !run || !isCurrentOpenUpdate(run, version, ctx)) return;

    // Keep the owner's committed open fact authoritative: observing an outside
    // focus must not close Presence or restore focus before a controlled owner
    // accepts the request. Entry remains enabled for newer independent intent;
    // unchanged open cannot rearm the canceled opening. Boundary retains the
    // trigger and portalled child regions.
    requestPopoverOpen(
      run,
      false,
      focusOutside ? 'focus.outside' : 'outside.press',
      returnFocusReason
    );
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
