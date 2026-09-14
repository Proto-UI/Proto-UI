import { defineAsHook, definePrototype, tw, type DefHandle } from '@proto.ui/core';
import { asAccessible, asBoundary, asFocusScope, asOverlay } from '@proto.ui/hooks';
import { asTransition } from '../tools';
import {
  DIALOG_CONTEXT,
  DIALOG_FAMILY,
  createDialogPartId,
  requestDialogOpen,
  type DialogContextValue,
  type DialogOpenFocusReason,
} from './shared';
import type {
  DialogContentAsHookContract,
  DialogContentExposes,
  DialogContentHandles,
  DialogContentProps,
} from './types';

function projectDialogContentHandle(
  result: import('@proto.ui/core').AsHookResult<DialogContentProps, DialogContentAsHookContract>
): DialogContentHandles {
  // C-AS-HOOK-0009-E, C-AS-HOOK-0009-F: selectively re-export Transition's
  // stable child handle without flattening its state into Dialog Content.
  const open = result.getState?.('open');
  const asTransition = result.getAsHookHandle?.('asTransition');
  if (!open || !asTransition) {
    throw new Error('[as-dialog-content] missing captured Dialog or Transition handles.');
  }
  return { stateHandles: { open }, asTransition };
}

function setupDialogContent(def: DefHandle<DialogContentProps, DialogContentExposes>): void {
  const accessible = asAccessible();
  // P-BASE-DIALOG-CONTENT-PRESENCE, P-BASE-DIALOG-CONTENT-A11Y-ROLE
  def.anatomy.claim(DIALOG_FAMILY, { role: 'content' });

  const alertProp = def.state.bool('alert', false);
  const role = def.state.string('dialogRole', 'dialog', {
    options: ['dialog', 'alertdialog'],
  });
  const modal = def.state.bool('dialogModal', true);
  const contentId = def.state.string('dialogContentId', '');
  const accessibleLabel = def.state.string('dialogAccessibleLabel', '');
  const labelledBy = def.state.string('dialogLabelledBy', '');
  const describedBy = def.state.string('dialogDescribedBy', '');
  // P-BASE-DIALOG-CONTENT-A11Y-ROLE, P-BASE-DIALOG-CONTENT-A11Y-RELATIONS
  accessible.id(contentId);
  accessible.role(role);
  accessible.name(accessibleLabel);
  accessible.state('modal', modal);
  accessible.relation('labelledBy', { target: labelledBy });
  accessible.relation('describedBy', { target: describedBy });

  // P-BASE-DIALOG-CONTENT-DISMISS, P-BASE-DIALOG-CONTENT-FOCUS
  const overlay = asOverlay<DialogContentProps>();
  overlay.configure({
    closeOnEscape: true,
    closeOnOutsidePress: false,
    closeOnFocusOutside: false,
    restore: 'trigger',
    entry: 'content',
    placement: 'center' as any,
    portal: true,
    modal: false,
    layerRole: 'dialog-content',
  });
  // P-BASE-DIALOG-CONTENT-DISMISS
  const boundary = asBoundary();
  boundary.observe('pointer.press');

  // P-BASE-DIALOG-CONTENT-FOCUS
  const focusScope = asFocusScope<DialogContentProps>();
  focusScope.configure({ trap: true, loop: true });

  // P-BASE-DIALOG-CONTENT-PRESENCE
  const transition = asTransition();
  overlay.bindPresence({
    enter: transition.controls.enter,
    leave: transition.controls.leave,
    present: transition.isPresent,
  });

  const open = def.state.bool('open', false);
  def.expose.state('open', open);

  let mountedRun: any = null;
  let currentContext: DialogContextValue | null = null;
  let warnedMissingAlertDescription = false;

  const hasLivePart = (run: any, role: 'title' | 'description'): boolean => {
    try {
      return run.anatomy.has(DIALOG_FAMILY, role);
    } catch (error) {
      if ((error as { code?: string })?.code === 'ANATOMY_CLAIM_INVALID') return false;
      throw error;
    }
  };

  const syncA11yRelations = (run: any, ctx: DialogContextValue) => {
    // P-BASE-DIALOG-CONTENT-A11Y-RELATIONS
    // P-BASE-DIALOG-DESCRIPTION-ALERT
    const hasTitle = hasLivePart(run, 'title');
    const hasDescription = hasLivePart(run, 'description');
    labelledBy.set(
      hasTitle ? createDialogPartId(ctx.rootId, 'title') : '',
      'reason: dialog live title relation sync'
    );
    accessibleLabel.set(
      hasTitle ? '' : ctx.a11yLabel,
      'reason: dialog accessible label fallback sync'
    );
    describedBy.set(
      hasDescription ? createDialogPartId(ctx.rootId, 'description') : '',
      'reason: dialog live description relation sync'
    );

    if (!mountedRun || !ctx.alert || hasDescription) {
      warnedMissingAlertDescription = false;
      return;
    }
    if (warnedMissingAlertDescription) return;
    warnedMissingAlertDescription = true;
    console.warn(
      '[base-dialog-content] Alert Dialog requires a Dialog Description containing its primary message.'
    );
  };

  def.anatomy.subscribeParts(DIALOG_FAMILY, 'title', (run) => {
    if (currentContext) syncA11yRelations(run, currentContext);
  });
  def.anatomy.subscribeParts(DIALOG_FAMILY, 'description', (run) => {
    if (currentContext) syncA11yRelations(run, currentContext);
  });

  const updateOpen = (
    nextOpen: boolean,
    reason?: string,
    options?: { focusReason?: DialogOpenFocusReason | null }
  ) => {
    // P-BASE-DIALOG-CONTENT-PRESENCE, P-BASE-DIALOG-CONTENT-FOCUS
    const prevOpen = open.get();
    open.set(nextOpen, reason ?? 'reason: dialog content sync => open');
    if (nextOpen) {
      overlay.openOverlay(reason ?? 'dialog.open');
    } else {
      overlay.close(reason ?? 'dialog.close');
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
      if (prevOpen) focusScope.deactivate({ reason: options?.focusReason ?? 'programmatic' });
    }
  };

  const syncIdentity = (ctx: DialogContextValue) => {
    // P-BASE-DIALOG-CONTENT-A11Y-RELATIONS
    contentId.set(createDialogPartId(ctx.rootId, 'content'), 'reason: dialog content id sync');
  };

  const syncAlert = (ctx: DialogContextValue) => {
    // P-BASE-DIALOG-CONTENT-A11Y-ROLE
    const alert = ctx.alert;
    alertProp.set(alert, 'reason: dialog alert sync');
    role.set(alert ? 'alertdialog' : 'dialog', 'reason: dialog semantic role sync');
  };

  def.context.subscribe(DIALOG_CONTEXT, (run, next) => {
    currentContext = next;
    syncIdentity(next);
    syncAlert(next);
    syncA11yRelations(run, next);
    updateOpen(next.open, 'reason: dialog context sync => content', {
      focusReason: next.open ? next.openFocusReason : next.returnFocusReason,
    });
  });

  def.lifecycle.onCreated((run) => {
    const ctx = run.context.read(DIALOG_CONTEXT);
    currentContext = ctx;
    syncIdentity(ctx);
    syncAlert(ctx);
    syncA11yRelations(run, ctx);
    updateOpen(ctx.open, 'reason: lifecycle.onCreated => dialog content open sync', {
      focusReason: ctx.open ? ctx.openFocusReason : ctx.returnFocusReason,
    });
  });

  def.lifecycle.onMounted((run) => {
    mountedRun = run;
    const ctx = run.context.read(DIALOG_CONTEXT);
    currentContext = ctx;
    syncIdentity(ctx);
    syncAlert(ctx);
    syncA11yRelations(run, ctx);
    updateOpen(ctx.open, 'reason: lifecycle.onMounted => dialog content open sync', {
      focusReason: ctx.open ? ctx.openFocusReason : ctx.returnFocusReason,
    });
  });

  def.lifecycle.onUnmounted(() => {
    mountedRun = null;
    currentContext = null;
  });

  overlay.open.watch((_ctx, event) => {
    // P-BASE-DIALOG-CONTENT-DISMISS, P-BASE-DIALOG-CONTENT-CONTROLLED
    if (event.type !== 'next' || event.next || event.reason !== 'escape') return;
    const run = mountedRun;
    if (!run) return;
    const ctx = currentContext;
    if (!ctx) return;
    if (!ctx.open) return;
    requestDialogOpen(run, false, 'escape', 'keyboard');
    if (ctx.controlled) overlay.openOverlay('controlled.sync');
  });

  boundary.subscribeOutside(() => {
    // P-BASE-DIALOG-CONTENT-DISMISS, P-BASE-DIALOG-CONTENT-CONTROLLED
    if (!overlay.isOpen()) return;
    const returnFocusReason: DialogOpenFocusReason = 'pointer';
    const run = mountedRun;
    if (!run) return;
    const ctx = currentContext;
    if (!ctx) return;
    if (!ctx.open) return;
    if (alertProp.get()) return;

    requestDialogOpen(run, false, 'outside.press', returnFocusReason);
  });

  def.rule({
    // P-BASE-DIALOG-CONTENT-PRESENCE
    when: (w) => w.state(transition.isPresent).eq(false),
    intent: (i) => i.feedback.style.use(tw('hidden')),
  });
}

// P-BASE-DIALOG-CONTENT-AUTHORING-ENTRIES
export const asDialogContent = defineAsHook<
  DialogContentProps,
  DialogContentExposes,
  DialogContentAsHookContract,
  DialogContentHandles
>({
  name: 'as-dialog-content',
  setup: setupDialogContent,
  projectHandle: projectDialogContentHandle,
});

const dialogContent = definePrototype({
  name: 'base-dialog-content',
  setup(def) {
    setupDialogContent(def);
    def.feedback.style.use(tw('fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'));
  },
});

export default dialogContent;
