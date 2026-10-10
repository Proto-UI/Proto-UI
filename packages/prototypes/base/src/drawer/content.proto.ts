import { defineAsHook, definePrototype, tw, type DefHandle } from '@proto.ui/core';
import { asAccessible, asBoundary, asFocusScope, asOverlay } from '@proto.ui/hooks';
import { asTransition } from '../tools';
import {
  DRAWER_CONTEXT,
  DRAWER_FAMILY,
  createDrawerPartId,
  requestDrawerOpen,
  type DrawerContextValue,
  type DrawerOpenFocusReason,
} from './shared';
import type {
  DrawerContentAsHookContract,
  DrawerContentExposes,
  DrawerContentHandles,
  DrawerContentProps,
} from './types';

function projectDrawerContentHandle(
  result: import('@proto.ui/core').AsHookResult<DrawerContentProps, DrawerContentAsHookContract>
): DrawerContentHandles {
  // C-AS-HOOK-0009-E, C-AS-HOOK-0009-F: selectively re-export Transition's
  // stable child handle without flattening its state into Drawer Content.
  const open = result.getState?.('open');
  const asTransition = result.getAsHookHandle?.('asTransition');
  if (!open || !asTransition) {
    throw new Error('[as-drawer-content] missing captured Drawer or Transition handles.');
  }
  return { stateHandles: { open }, asTransition };
}

function setupDrawerContent(def: DefHandle<DrawerContentProps, DrawerContentExposes>): void {
  const accessible = asAccessible();

  def.anatomy.claim(DRAWER_FAMILY, { role: 'content' });

  const alertProp = def.state.bool('alert', false);
  const role = def.state.string('drawerRole', 'dialog', {
    options: ['dialog', 'alertdialog'],
  });
  const modal = def.state.bool('drawerModal', true);
  const contentId = def.state.string('drawerContentId', '');
  const accessibleLabel = def.state.string('drawerAccessibleLabel', '');
  const labelledBy = def.state.string('drawerLabelledBy', '');
  const describedBy = def.state.string('drawerDescribedBy', '');

  accessible.id(contentId);
  accessible.role(role);
  accessible.name(accessibleLabel);
  accessible.state('modal', modal);
  accessible.relation('labelledBy', { target: labelledBy });
  accessible.relation('describedBy', { target: describedBy });

  const overlay = asOverlay<DrawerContentProps>();
  overlay.configure({
    closeOnEscape: true,
    closeOnOutsidePress: false,
    closeOnFocusOutside: false,
    restore: 'trigger',
    entry: 'content',
    availableSpace: true,
    portal: true,
    modal: false,
    layerRole: 'drawer-content',
  });

  const boundary = asBoundary();
  boundary.observe('pointer.press');

  const focusScope = asFocusScope<DrawerContentProps>();
  focusScope.configure({ trap: true, loop: true });

  const transition = asTransition();
  overlay.bindPresence({
    enter: transition.controls.enter,
    leave: transition.controls.leave,
    present: transition.isPresent,
  });

  def.props.define({ side: { type: 'string', empty: 'fallback' } });
  def.props.setDefaults({ side: 'bottom' });
  const side = def.state.string('drawerSide', 'bottom', {
    options: ['top', 'right', 'bottom', 'left'],
  });
  const syncSide = (run: any) => side.set(run.props.get().side ?? 'bottom', 'reason: drawer edge');
  def.lifecycle.onCreated(syncSide);
  def.props.watch(['side'], syncSide);
  def.feedback.style.use(
    tw(
      'fixed overflow-y-auto max-w-[var(--proto-ui-available-region-width,100%)] max-h-[var(--proto-ui-available-region-height,100%)]'
    )
  );
  for (const [edge, classes] of Object.entries({
    bottom: 'inset-x-0 bottom-0 w-full max-h-[85vh]',
    top: 'inset-x-0 top-0 w-full max-h-[85vh]',
    left: 'inset-y-0 left-0 w-80',
    right: 'inset-y-0 right-0 w-80',
  }))
    def.rule({
      when: (w) => w.state(side).eq(edge),
      intent: (i) => i.feedback.style.use(tw(classes)),
    });
  const open = def.state.bool('open', false);
  def.expose.state('open', open);

  let mountedRun: any = null;
  let currentContext: DrawerContextValue | null = null;
  let warnedMissingAlertDescription = false;

  const hasLivePart = (run: any, role: 'title' | 'description'): boolean => {
    try {
      return run.anatomy.has(DRAWER_FAMILY, role);
    } catch (error) {
      if ((error as { code?: string })?.code === 'ANATOMY_CLAIM_INVALID') return false;
      throw error;
    }
  };

  const syncA11yRelations = (run: any, ctx: DrawerContextValue) => {
    const hasTitle = hasLivePart(run, 'title');
    const hasDescription = hasLivePart(run, 'description');
    labelledBy.set(
      hasTitle ? createDrawerPartId(ctx.rootId, 'title') : '',
      'reason: drawer live title relation sync'
    );
    accessibleLabel.set(
      hasTitle ? '' : ctx.a11yLabel,
      'reason: drawer accessible label fallback sync'
    );
    describedBy.set(
      hasDescription ? createDrawerPartId(ctx.rootId, 'description') : '',
      'reason: drawer live description relation sync'
    );

    if (!mountedRun || !ctx.alert || hasDescription) {
      warnedMissingAlertDescription = false;
      return;
    }
    if (warnedMissingAlertDescription) return;
    warnedMissingAlertDescription = true;
    console.warn(
      '[base-drawer-content] Alert Drawer requires a Drawer Description containing its primary message.'
    );
  };

  def.anatomy.subscribeParts(DRAWER_FAMILY, 'title', (run) => {
    if (currentContext) syncA11yRelations(run, currentContext);
  });
  def.anatomy.subscribeParts(DRAWER_FAMILY, 'description', (run) => {
    if (currentContext) syncA11yRelations(run, currentContext);
  });

  const updateOpen = (
    nextOpen: boolean,
    reason?: string,
    options?: { focusReason?: DrawerOpenFocusReason | null }
  ) => {
    const prevOpen = open.get();
    open.set(nextOpen, reason ?? 'reason: drawer content sync => open');
    if (nextOpen) {
      overlay.openOverlay(reason ?? 'drawer.open');
    } else {
      overlay.close(reason ?? 'drawer.close');
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

  const syncIdentity = (ctx: DrawerContextValue) => {
    contentId.set(createDrawerPartId(ctx.rootId, 'content'), 'reason: drawer content id sync');
  };

  const syncAlert = (ctx: DrawerContextValue) => {
    const alert = ctx.alert;
    alertProp.set(alert, 'reason: drawer alert sync');
    role.set(alert ? 'alertdialog' : 'dialog', 'reason: drawer semantic role sync');
  };

  def.context.subscribe(DRAWER_CONTEXT, (run, next) => {
    currentContext = next;
    syncIdentity(next);
    syncAlert(next);
    syncA11yRelations(run, next);
    updateOpen(next.open, 'reason: drawer context sync => content', {
      focusReason: next.open ? next.openFocusReason : next.returnFocusReason,
    });
  });

  def.lifecycle.onCreated((run) => {
    const ctx = run.context.read(DRAWER_CONTEXT);
    currentContext = ctx;
    syncIdentity(ctx);
    syncAlert(ctx);
    syncA11yRelations(run, ctx);
    updateOpen(ctx.open, 'reason: lifecycle.onCreated => drawer content open sync', {
      focusReason: ctx.open ? ctx.openFocusReason : ctx.returnFocusReason,
    });
  });

  def.lifecycle.onMounted((run) => {
    mountedRun = run;
    const ctx = run.context.read(DRAWER_CONTEXT);
    currentContext = ctx;
    syncIdentity(ctx);
    syncAlert(ctx);
    syncA11yRelations(run, ctx);
    updateOpen(ctx.open, 'reason: lifecycle.onMounted => drawer content open sync', {
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
    requestDrawerOpen(run, false, 'escape', 'keyboard');
    // Request delivery may synchronously replace the owner's open input.
    // Restore only a still-open controlled fact, never the pre-request snapshot.
    if (currentContext?.controlled && currentContext.open) overlay.openOverlay('controlled.sync');
  });

  boundary.subscribeOutside(() => {
    if (!overlay.isOpen()) return;
    const returnFocusReason: DrawerOpenFocusReason = 'pointer';
    const run = mountedRun;
    if (!run) return;
    const ctx = currentContext;
    if (!ctx) return;
    if (!ctx.open) return;
    if (alertProp.get()) return;

    requestDrawerOpen(run, false, 'outside.press', returnFocusReason);
  });

  def.rule({
    when: (w) => w.state(transition.isPresent).eq(false),
    intent: (i) => i.feedback.style.use(tw('hidden')),
  });
}

export const asDrawerContent = defineAsHook<
  DrawerContentProps,
  DrawerContentExposes,
  DrawerContentAsHookContract,
  DrawerContentHandles
>({
  name: 'as-drawer-content',
  setup: setupDrawerContent,
  projectHandle: projectDrawerContentHandle,
});

const drawerContent = definePrototype({
  name: 'base-drawer-content',
  setup(def) {
    setupDrawerContent(def);
  },
});

export default drawerContent;
