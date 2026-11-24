import { defineAsHook, definePrototype, tw, type DefHandle } from '@proto.ui/core';
import { asAccessible, asBoundary, asFocusable, asFocusScope, asOverlay } from '@proto.ui/hooks';
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
  def.props.define({
    focusEntry: { type: 'enum', empty: 'fallback', options: ['auto', 'manual', 'content'] },
  });
  def.props.setDefaults({ focusEntry: 'auto' });
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
    availableSpace: true,
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
  // P-BASE-DIALOG-CONTENT-CONTENT-ENTRY: the optional initial target is never
  // a sequential member. Auto/manual keep the ordinary disabled projection.
  const contentFocus = asFocusable<DialogContentProps>();
  contentFocus.configure({ disabled: true, navParticipation: 'none' });

  // P-BASE-DIALOG-CONTENT-PRESENCE
  const transition = asTransition();
  overlay.bindPresence({
    enter: transition.controls.enter,
    leave: transition.controls.leave,
    present: transition.isPresent,
  });

  const open = def.state.bool('open', false);
  def.expose.state('open', open);

  // Semantic dismissal belongs to the retained instance, not its physical view.
  let logicalRun: import('@proto.ui/core').RunHandle<DialogContentProps> | null = null;
  let mountedRun: any = null;
  let currentContext: DialogContextValue | null = null;
  let warnedMissingAlertDescription = false;
  let focusRevision = 0;
  let syncedRootId: string | undefined;
  let contentEntry: { rootId: string } | null = null;

  const retireContentEntry = () => {
    if (!contentEntry) return;
    // Publish retirement before disabling: fact notifications and native blur
    // can synchronously close, replace or reactivate this logical owner.
    contentEntry = null;
    contentFocus.setDisabled(true);
  };

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
    const syncRun = logicalRun;
    const syncRootId = currentContext?.rootId;
    if (!syncRootId || currentContext?.open !== nextOpen) return;
    const prevOpen = open.get();
    if (prevOpen !== nextOpen || syncedRootId !== syncRootId) focusRevision++;
    syncedRootId = syncRootId;
    let revision = focusRevision;
    const isCurrent = () =>
      focusRevision === revision &&
      logicalRun === syncRun &&
      currentContext?.rootId === syncRootId &&
      currentContext?.open === nextOpen &&
      open.get() === nextOpen;
    open.set(nextOpen, reason ?? 'reason: dialog content sync => open');
    if (!isCurrent()) return;
    if (!nextOpen) {
      // Scope deactivation cancels descendants, not its own target. Retire
      // that request before Presence can detach or rematerialize the view.
      retireContentEntry();
      if (!isCurrent()) return;
      overlay.close(reason ?? 'dialog.close');
      // Accepted close retires the logical scope even if zero-duration
      // Presence detached it; a newer activation owns its own restoration.
      if (prevOpen && syncRun && isCurrent() && !overlay.isOpen())
        focusScope.deactivate({ reason: options?.focusReason ?? 'programmatic' });
      return;
    }

    if (contentEntry && contentEntry.rootId !== syncRootId) {
      retireContentEntry();
      if (!isCurrent()) return;
      focusScope.deactivate({ reason: 'programmatic' });
      if (!isCurrent()) return;
    }
    overlay.openOverlay(reason ?? 'dialog.open');
    if (!isCurrent()) return;
    // Entry still needs the mounted physical view; do not consume it early.
    if (!mountedRun) return;
    if (!prevOpen || !focusScope.isActive()) {
      revision = ++focusRevision;
      const entryRun = mountedRun;
      const isCurrentEntry = () => isCurrent() && mountedRun === entryRun && overlay.isOpen();
      // A synchronous close/reopen can supersede the closing callback before
      // it reaches cleanup. Retire that old activation before capturing anew.
      if (contentEntry) {
        retireContentEntry();
        if (!isCurrentEntry()) return;
        focusScope.deactivate({ reason: 'programmatic' });
        if (!isCurrentEntry()) return;
      }
      // P-BASE-DIALOG-CONTENT-ENTRY-POLICY: read only for this activation.
      // Prop changes while active do not configure or reactivate the scope.
      const focusReason = options?.focusReason ?? 'programmatic';
      const policy = entryRun.props.get().focusEntry;
      if (policy === 'content') {
        const activation = { rootId: syncRootId };
        contentEntry = activation;
        // Capture the previous owner with ordinary scope semantics, while
        // suppressing automatic child entry for this activation only.
        focusScope.activate({ reason: focusReason, entry: 'manual' });
        if (!isCurrentEntry() || contentEntry !== activation || !focusScope.isActive()) return;
        contentFocus.setDisabled(false);
        if (!isCurrentEntry() || contentEntry !== activation || !focusScope.isActive()) return;
        // Native acquisition owns facts and current readiness retry; no
        // synthetic focus-visible override or page-specific target is needed.
        contentFocus.focusSelf({ reason: focusReason, preventScroll: true });
      } else if (policy === 'manual') {
        focusScope.activate({ reason: focusReason, entry: 'manual' });
      } else {
        focusScope.activate({ reason: focusReason });
      }
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
    logicalRun = run;
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
  });
  def.lifecycle.onBeforeDispose(() => {
    focusRevision++;
    logicalRun = null;
    mountedRun = null;
    currentContext = null;
    // Focus's disposing phase already cancels the target and removes its
    // Center entry. Calling a live setter here would register it again.
    contentEntry = null;
  });
  const readLiveContext = (run: import('@proto.ui/core').RunHandle<DialogContentProps>) => {
    try {
      return run.context.read(DIALOG_CONTEXT);
    } catch (error) {
      if ((error as { code?: string })?.code === 'CONTEXT_DISCONNECTED') return null;
      throw error;
    }
  };

  overlay.open.watch((_ctx, event) => {
    // P-BASE-DIALOG-CONTENT-DISMISS, P-BASE-DIALOG-CONTENT-CONTROLLED
    if (event.type !== 'next' || event.next || event.reason !== 'escape') return;
    // Presence may have synchronously detached the view before this watcher.
    // A newer open, disposal or Context rebind must not consume the old close.
    const run = logicalRun;
    const expectedRootId = currentContext?.rootId;
    if (!run || !expectedRootId || !open.get() || overlay.isOpen()) return;
    const ctx = readLiveContext(run);
    if (!ctx?.open || ctx.rootId !== expectedRootId) return;
    if (!requestDialogOpen(run, false, 'escape', 'keyboard', expectedRootId)) return;
    // Request delivery may synchronously replace the owner or its open input.
    if (logicalRun !== run) return;
    const current = readLiveContext(run);
    if (current?.rootId === expectedRootId && current.controlled && current.open && open.get())
      overlay.openOverlay('controlled.sync');
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
    def.feedback.style.use(
      tw(
        'fixed z-50 left-[var(--proto-ui-available-region-center-x,50%)] top-[var(--proto-ui-available-region-center-y,50%)] max-w-[var(--proto-ui-available-region-width,100%)] max-h-[var(--proto-ui-available-region-height,100%)] overflow-y-auto -translate-x-1/2 -translate-y-1/2'
      )
    );
  },
});

export default dialogContent;
