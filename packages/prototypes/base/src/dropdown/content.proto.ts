import { defineAsHook, definePrototype, tw, type DefHandle } from '@proto.ui/core';
import { asBoundary, asFocusRoving, asFocusScope, asOverlay } from '@proto.ui/hooks';
import { useTypeaheadNavigation } from '../behaviors';
import { asTransition } from '../tools';
import {
  createDropdownContentId,
  DROPDOWN_CONTEXT,
  DROPDOWN_FAMILY,
  requestDropdownOpen,
  type DropdownContextValue,
} from './shared';
import type {
  DropdownContentAsHookContract,
  DropdownContentExposes,
  DropdownContentHandles,
  DropdownContentProps,
} from './types';

function projectDropdownContentHandle(
  result: import('@proto.ui/core').AsHookResult<DropdownContentProps, DropdownContentAsHookContract>
): DropdownContentHandles {
  const open = result.getState?.('open');
  const asTransition = result.getAsHookHandle?.('asTransition');
  if (!open || !asTransition) {
    throw new Error('[as-dropdown-content] missing captured Dropdown or Transition handles.');
  }
  return { stateHandles: { open }, asTransition };
}

function setupDropdownContent(
  def: DefHandle<DropdownContentProps, DropdownContentExposes>,
  _options?: void,
  api?: { store: Record<string, unknown> }
): void {
  def.anatomy.claim(DROPDOWN_FAMILY, { role: 'content' });
  def.props.define({
    side: { type: 'enum', empty: 'fallback', options: ['top', 'right', 'bottom', 'left'] },
    align: { type: 'enum', empty: 'fallback', options: ['start', 'center', 'end'] },
    sideOffset: { type: 'number', empty: 'fallback' },
    alignOffset: { type: 'number', empty: 'fallback' },
    avoidCollisions: { type: 'boolean', empty: 'fallback' },
    collisionPadding: { type: 'number', empty: 'fallback' },
    excludeAnchorTranslation: { type: 'boolean', empty: 'fallback' },
  });
  def.props.setDefaults({
    side: 'bottom',
    align: 'center',
    sideOffset: 4,
    alignOffset: 0,
    avoidCollisions: true,
    collisionPadding: 0,
    excludeAnchorTranslation: false,
  });

  const contentId = def.state.string('dropdownContentId', '');
  const orientation = def.state.string('dropdownOrientation', 'vertical');
  // P-BASE-DROPDOWN-MENU-CONTENT-A11Y
  def.a11y.id(contentId);
  def.a11y.role('menu');
  def.a11y.state('orientation', orientation);

  let currentContext: DropdownContextValue | null = null;
  const focusScope = asFocusScope<DropdownContentProps>();
  focusScope.configure({ entry: 'manual', restore: 'none' });
  const focusRoving = asFocusRoving<DropdownContentProps>();
  focusRoving.configure({ navigation: 'arrow', orientation: 'vertical', entry: 'manual' });
  def.expose.method('focusFirst', () => focusRoving.focusFirst());
  def.expose.method('focusLast', () => focusRoving.focusLast());
  def.expose.method('focusNext', () => focusRoving.focusNext());
  def.expose.method('focusPrev', () => focusRoving.focusPrev());

  // P-BASE-DROPDOWN-MENU-CONTENT-OVERLAY, P-BASE-DROPDOWN-MENU-CONTENT-ANCHOR-PORTAL
  const overlay = asOverlay<DropdownContentProps>();
  overlay.configure({
    closeOnEscape: true,
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
    excludeAnchorTranslation: false,
    portal: true,
    modal: false,
    layerRole: 'dropdown-menu-content',
    meta: { overlayKind: 'dropdown-menu' },
  });
  const boundary = asBoundary();
  boundary.observe('pointer.press');

  // P-BASE-DROPDOWN-MENU-CONTENT-PRESENCE
  const transition = asTransition();
  transition.configure({ enterDuration: 0, leaveDuration: 0 });
  overlay.bindPresence({
    enter: transition.controls.enter,
    leave: transition.controls.leave,
    present: transition.isPresent,
  });

  const open = def.state.bool('open', false);
  def.expose.state('open', open);
  const store = (api?.store ?? {}) as {
    run: any;
  };
  store.run = null;

  const readContext = (run: any): DropdownContextValue | null => {
    try {
      return run.context.read(DROPDOWN_CONTEXT);
    } catch (error) {
      if ((error as { code?: string })?.code === 'CONTEXT_DISCONNECTED') return null;
      throw error;
    }
  };

  const getNavigationEntries = (run: any) =>
    run.anatomy.order.partsOf(DROPDOWN_FAMILY, 'item').map((item: any) => ({
      snapshot: item.getExpose('getCollectionItem')?.() as Record<string, unknown> | undefined,
      focusSelf: item.getExpose('focusSelf') as
        | ((options?: { reason?: 'programmatic' | 'keyboard' | 'pointer' }) => void)
        | null,
      focused: !!(item.getExpose('focused') as { get?: () => boolean } | null)?.get?.(),
    }));

  useTypeaheadNavigation({
    isEnabled: (run) => {
      const ctx = readContext(run);
      return (
        !!ctx?.open &&
        !ctx.disabled &&
        getNavigationEntries(run).some((entry: any) => entry.focused)
      );
    },
    getEntries: (run) =>
      getNavigationEntries(run).filter((entry: any) => !!entry.snapshot && !!entry.focusSelf),
    getCurrentIndex: (_run, entries) => entries.findIndex((entry: any) => entry.focused),
    getText: (entry: any) => String(entry.snapshot?.textValue || entry.snapshot?.value || ''),
    onMatch: (_run, entry: any) => entry.focusSelf?.({ reason: 'keyboard' }),
  });

  const focusValue = (
    run: any,
    value: string,
    options: { reason: 'keyboard' | 'pointer' | 'programmatic'; preventScroll: boolean }
  ) => {
    if (!value) return false;
    const entry = getNavigationEntries(run).find(
      (candidate: any) => String(candidate.snapshot?.value ?? '') === value
    );
    if (!entry?.focusSelf) return false;
    entry.focusSelf(options);
    return true;
  };

  const resolveOpenFocusAction = (run: any, ctx: DropdownContextValue) => {
    const entry = ctx.requestEntry ?? ctx.openEntry;
    const options = {
      defer: true,
      preventScroll: true,
      reason: ctx.requestFocusReason ?? ('programmatic' as const),
    };
    if (entry === 'last') {
      focusRoving.focusLast(options);
      return;
    }
    if (entry === 'value-or-first' && focusValue(run, ctx.openEntryValue, options)) {
      return;
    }
    if (entry === 'active-or-first' && focusValue(run, ctx.activeValue, options)) {
      return;
    }
    focusRoving.focusFirst(options);
  };

  const syncPosition = (run: any) => {
    // P-BASE-DROPDOWN-MENU-CONTENT-POSITION
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
      excludeAnchorTranslation: props.excludeAnchorTranslation,
    });
  };

  const focusTrigger = (run: any, reason: 'keyboard' | 'pointer' | 'programmatic') => {
    const trigger = run.anatomy.partsOf(DROPDOWN_FAMILY, 'trigger')[0] ?? null;
    const focusSelf = trigger?.getExpose('focusSelf') as
      | ((options?: { reason?: 'keyboard' | 'pointer' | 'programmatic' }) => void)
      | null;
    focusSelf?.({ reason });
  };

  def.props.watch(
    [
      'side',
      'align',
      'sideOffset',
      'alignOffset',
      'avoidCollisions',
      'collisionPadding',
      'excludeAnchorTranslation',
    ],
    (run) => syncPosition(run)
  );

  const updateOpen = (run: any, ctx: DropdownContextValue, reason: string) => {
    const wasOpen = open.get();
    const menuStillOwnsFocus =
      wasOpen && getNavigationEntries(run).some((entry: any) => entry.focused);
    currentContext = ctx;
    contentId.set(createDropdownContentId(ctx.rootId), 'reason: dropdown content identity sync');
    open.set(ctx.open, reason);
    if (ctx.open) {
      overlay.openOverlay(reason);
      if (!wasOpen) {
        focusScope.activate({ reason: ctx.requestFocusReason ?? 'programmatic' });
        resolveOpenFocusAction(run, ctx);
      }
      return;
    }
    if (wasOpen) focusScope.deactivate({ reason: ctx.requestFocusReason ?? 'programmatic' });
    overlay.close(reason);
    if (
      wasOpen &&
      (ctx.requestReason === 'escape' ||
        (ctx.requestReason === 'item.select' && menuStillOwnsFocus))
    ) {
      focusTrigger(run, ctx.requestFocusReason ?? 'programmatic');
    }
  };

  def.context.subscribe(DROPDOWN_CONTEXT, (run, next) => {
    updateOpen(run, next, 'reason: dropdown context sync => content open');
  });
  def.lifecycle.onCreated((run) => {
    const ctx = readContext(run);
    if (!ctx) return;
    currentContext = ctx;
    contentId.set(createDropdownContentId(ctx.rootId), 'reason: dropdown content identity init');
    syncPosition(run);
    updateOpen(run, ctx, 'reason: lifecycle.onCreated => dropdown content sync');
  });
  def.lifecycle.onMounted((run) => {
    store.run = run;
    const trigger = run.anatomy.partsOf(DROPDOWN_FAMILY, 'trigger')[0] ?? null;
    if (trigger) overlay.registerAnchorPart(trigger);
    syncPosition(run);
    const ctx = run.context.read(DROPDOWN_CONTEXT);
    const replayDeferredEntry = ctx.open && open.get();
    updateOpen(run, ctx, 'reason: lifecycle.onMounted => dropdown content sync');
    // Owner state can open while the previous view is detached. Replaying the
    // same entry intent at the public mounted checkpoint gives Focus a stable
    // target epoch without a private Item handshake or host timing primitive.
    if (replayDeferredEntry) resolveOpenFocusAction(run, ctx);
  });

  overlay.open.watch((_ctx, event) => {
    if (event.type !== 'next' || event.next || event.reason !== 'escape') return;
    const run = store.run;
    const ctx = currentContext;
    if (!run || !ctx?.open) return;
    requestDropdownOpen(run, false, 'escape', 'keyboard');
    if (ctx.controlled) overlay.openOverlay('controlled.sync');
  });

  def.event.onGlobal('key.down', (run, ev) => {
    if (store.run !== run) return;
    const ctx = readContext(run);
    if (!ctx) return;
    if (!ctx.open || ctx.disabled) return;
    const key = ev?.key;
    if (key !== 'Tab') return;
    if (!getNavigationEntries(run).some((entry: any) => entry.focused)) return;
    // P-BASE-DROPDOWN-MENU-CONTENT-DISMISS: do not prevent host traversal.
    requestDropdownOpen(run, false, 'tab', 'keyboard');
  });

  boundary.subscribeOutside(() => {
    const run = store.run;
    const ctx = currentContext;
    if (!run || !ctx?.open || ctx.disabled) return;
    requestDropdownOpen(run, false, 'outside.press', 'pointer');
  });

  def.lifecycle.onUnmounted(() => {
    store.run = null;
    currentContext = null;
  });

  def.rule({
    when: (w) => w.state(transition.isPresent).eq(false),
    intent: (i) => i.feedback.style.use(tw('hidden')),
  });
}

// P-BASE-DROPDOWN-MENU-CONTENT-AUTHORING-ENTRIES
export const asDropdownContent = defineAsHook<
  DropdownContentProps,
  DropdownContentExposes,
  DropdownContentAsHookContract,
  DropdownContentHandles
>({
  name: 'as-dropdown-content',
  setup: setupDropdownContent,
  projectHandle: projectDropdownContentHandle,
});

const dropdownContent = definePrototype({
  name: 'base-dropdown-content',
  setup(def) {
    setupDropdownContent(def);
    def.feedback.style.use(tw('absolute z-40'));
  },
});

export default dropdownContent;
