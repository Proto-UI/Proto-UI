import { defineAsHook, definePrototype, tw, type DefHandle } from '@proto.ui/core';
import { asAccessible, asBoundary, asFocusScope, asOverlay } from '@proto.ui/hooks';
import { asTransition } from '../tools';
import {
  ALERT_DIALOG_CONTEXT,
  ALERT_DIALOG_FAMILY,
  createAlertDialogPartId,
  requestAlertDialogOpen,
  type AlertDialogContextValue,
  type AlertDialogOpenFocusReason,
} from './shared';
import type {
  AlertDialogContentAsHookContract,
  AlertDialogContentExposes,
  AlertDialogContentHandles,
  AlertDialogContentProps,
} from './types';

function projectAlertDialogContentHandle(
  result: import('@proto.ui/core').AsHookResult<
    AlertDialogContentProps,
    AlertDialogContentAsHookContract
  >
): AlertDialogContentHandles {
  // C-AS-HOOK-0009-E, C-AS-HOOK-0009-F: selectively re-export Transition's
  // stable child handle without flattening its state into AlertDialog Content.
  const open = result.getState?.('open');
  const asTransition = result.getAsHookHandle?.('asTransition');
  if (!open || !asTransition) {
    throw new Error(
      '[as-alert-dialog-content] missing captured AlertDialog or Transition handles.'
    );
  }
  return { stateHandles: { open }, asTransition };
}

function setupAlertDialogContent(
  def: DefHandle<AlertDialogContentProps, AlertDialogContentExposes>
): void {
  const accessible = asAccessible();

  def.anatomy.claim(ALERT_DIALOG_FAMILY, { role: 'content' });

  const alertProp = def.state.bool('alert', false);
  const role = def.state.string('alertDialogRole', 'dialog', {
    options: ['dialog', 'alertdialog'],
  });
  const modal = def.state.bool('alertDialogModal', true);
  const contentId = def.state.string('alertDialogContentId', '');
  const accessibleLabel = def.state.string('alertDialogAccessibleLabel', '');
  const labelledBy = def.state.string('alertDialogLabelledBy', '');
  const describedBy = def.state.string('alertDialogDescribedBy', '');

  accessible.id(contentId);
  accessible.role(role);
  accessible.name(accessibleLabel);
  accessible.state('modal', modal);
  accessible.relation('labelledBy', { target: labelledBy });
  accessible.relation('describedBy', { target: describedBy });

  const overlay = asOverlay<AlertDialogContentProps>();
  overlay.configure({
    closeOnEscape: true,
    closeOnOutsidePress: false,
    closeOnFocusOutside: false,
    restore: 'trigger',
    entry: 'content',
    availableSpace: true,
    portal: true,
    modal: false,
    layerRole: 'alertDialog-content',
  });

  const boundary = asBoundary();
  boundary.observe('pointer.press');

  const focusScope = asFocusScope<AlertDialogContentProps>();
  focusScope.configure({ trap: true, loop: true, entry: 'manual' });

  const transition = asTransition();
  overlay.bindPresence({
    enter: transition.controls.enter,
    leave: transition.controls.leave,
    present: transition.isPresent,
  });

  const open = def.state.bool('open', false);
  def.expose.state('open', open);

  let mountedRun: any = null;
  let currentContext: AlertDialogContextValue | null = null;
  let warnedMissingAlertDescription = false;

  const hasLivePart = (run: any, role: 'title' | 'description'): boolean => {
    try {
      return run.anatomy.has(ALERT_DIALOG_FAMILY, role);
    } catch (error) {
      if ((error as { code?: string })?.code === 'ANATOMY_CLAIM_INVALID') return false;
      throw error;
    }
  };

  const syncA11yRelations = (run: any, ctx: AlertDialogContextValue) => {
    const hasTitle = hasLivePart(run, 'title');
    const hasDescription = hasLivePart(run, 'description');
    labelledBy.set(
      hasTitle ? createAlertDialogPartId(ctx.rootId, 'title') : '',
      'reason: alertDialog live title relation sync'
    );
    accessibleLabel.set(
      hasTitle ? '' : ctx.a11yLabel,
      'reason: alertDialog accessible label fallback sync'
    );
    describedBy.set(
      hasDescription ? createAlertDialogPartId(ctx.rootId, 'description') : '',
      'reason: alertDialog live description relation sync'
    );

    if (!mountedRun || !ctx.alert || hasDescription) {
      warnedMissingAlertDescription = false;
      return;
    }
    if (warnedMissingAlertDescription) return;
    warnedMissingAlertDescription = true;
    console.warn(
      '[base-alert-dialog-content] Alert AlertDialog requires a AlertDialog Description containing its primary message.'
    );
  };

  def.anatomy.subscribeParts(ALERT_DIALOG_FAMILY, 'title', (run) => {
    if (currentContext) syncA11yRelations(run, currentContext);
  });
  def.anatomy.subscribeParts(ALERT_DIALOG_FAMILY, 'description', (run) => {
    if (currentContext) syncA11yRelations(run, currentContext);
  });

  const updateOpen = (
    nextOpen: boolean,
    reason?: string,
    options?: { focusReason?: AlertDialogOpenFocusReason | null }
  ) => {
    const prevOpen = open.get();
    open.set(nextOpen, reason ?? 'reason: alertDialog content sync => open');
    if (nextOpen) {
      overlay.openOverlay(reason ?? 'alertDialog.open');
    } else {
      overlay.close(reason ?? 'alertDialog.close');
    }
    // Context remains live while the L1 view is detached. Structural intent
    // is driven by Transition below, but overlay/focus effects require a
    // mounted view and must not be consumed early by the retained instance.
    if (!mountedRun) return;
    if (nextOpen) {
      if (!prevOpen || !focusScope.isActive()) {
        focusScope.activate({ reason: options?.focusReason ?? 'programmatic' });
        const cancel = mountedRun.anatomy.partsOf(ALERT_DIALOG_FAMILY, 'cancel')[0];
        const focus = cancel?.getExpose('focusSelf');
        if (typeof focus === 'function') focus({ reason: options?.focusReason ?? 'programmatic' });
      }
    } else {
      if (prevOpen) focusScope.deactivate({ reason: options?.focusReason ?? 'programmatic' });
    }
  };

  const syncIdentity = (ctx: AlertDialogContextValue) => {
    contentId.set(
      createAlertDialogPartId(ctx.rootId, 'content'),
      'reason: alertDialog content id sync'
    );
  };

  const syncAlert = (ctx: AlertDialogContextValue) => {
    const alert = ctx.alert;
    alertProp.set(alert, 'reason: alertDialog alert sync');
    role.set(alert ? 'alertdialog' : 'dialog', 'reason: alertDialog semantic role sync');
  };

  def.context.subscribe(ALERT_DIALOG_CONTEXT, (run, next) => {
    currentContext = next;
    syncIdentity(next);
    syncAlert(next);
    syncA11yRelations(run, next);
    updateOpen(next.open, 'reason: alertDialog context sync => content', {
      focusReason: next.open ? next.openFocusReason : next.returnFocusReason,
    });
  });

  def.lifecycle.onCreated((run) => {
    const ctx = run.context.read(ALERT_DIALOG_CONTEXT);
    currentContext = ctx;
    syncIdentity(ctx);
    syncAlert(ctx);
    syncA11yRelations(run, ctx);
    updateOpen(ctx.open, 'reason: lifecycle.onCreated => alertDialog content open sync', {
      focusReason: ctx.open ? ctx.openFocusReason : ctx.returnFocusReason,
    });
  });

  def.lifecycle.onMounted((run) => {
    mountedRun = run;
    const ctx = run.context.read(ALERT_DIALOG_CONTEXT);
    currentContext = ctx;
    syncIdentity(ctx);
    syncAlert(ctx);
    syncA11yRelations(run, ctx);
    updateOpen(ctx.open, 'reason: lifecycle.onMounted => alertDialog content open sync', {
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
    requestAlertDialogOpen(run, false, 'escape', 'keyboard');
    // Request delivery may synchronously replace the owner's open input.
    // Restore only a still-open controlled fact, never the pre-request snapshot.
    if (currentContext?.controlled && currentContext.open) overlay.openOverlay('controlled.sync');
  });

  boundary.subscribeOutside(() => {
    if (!overlay.isOpen()) return;
    const returnFocusReason: AlertDialogOpenFocusReason = 'pointer';
    const run = mountedRun;
    if (!run) return;
    const ctx = currentContext;
    if (!ctx) return;
    if (!ctx.open) return;
    if (alertProp.get()) return;

    requestAlertDialogOpen(run, false, 'outside.press', returnFocusReason);
  });

  def.rule({
    when: (w) => w.state(transition.isPresent).eq(false),
    intent: (i) => i.feedback.style.use(tw('hidden')),
  });
}

export const asAlertDialogContent = defineAsHook<
  AlertDialogContentProps,
  AlertDialogContentExposes,
  AlertDialogContentAsHookContract,
  AlertDialogContentHandles
>({
  name: 'as-alert-dialog-content',
  setup: setupAlertDialogContent,
  projectHandle: projectAlertDialogContentHandle,
});

const alertDialogContent = definePrototype({
  name: 'base-alert-dialog-content',
  setup(def) {
    setupAlertDialogContent(def);
    def.feedback.style.use(
      tw(
        'fixed left-[var(--proto-ui-available-region-center-x,50%)] top-[var(--proto-ui-available-region-center-y,50%)] max-w-[var(--proto-ui-available-region-width,100%)] max-h-[var(--proto-ui-available-region-height,100%)] overflow-y-auto -translate-x-1/2 -translate-y-1/2'
      )
    );
  },
});

export default alertDialogContent;
