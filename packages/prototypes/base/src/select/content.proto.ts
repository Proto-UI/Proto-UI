import { defineAsHook, definePrototype, delay, tw, type DefHandle } from '@proto.ui/core';
import { asBoundary, asFocusRoving, asFocusScope, asOverlay } from '@proto.ui/hooks';
import { useTypeaheadNavigation } from '../behaviors';
import { asTransition } from '../tools';
import {
  createSelectContentId,
  requestSelectOpen,
  SELECT_CONTEXT,
  SELECT_FAMILY,
  type SelectContextValue,
} from './shared';
import type {
  SelectContentAsHookContract,
  SelectContentExposes,
  SelectContentHandles,
  SelectContentProps,
} from './types';

function projectSelectContentHandle(
  result: import('@proto.ui/core').AsHookResult<SelectContentProps, SelectContentAsHookContract>
): SelectContentHandles {
  const open = result.getState?.('open');
  const asTransition = result.getAsHookHandle?.('asTransition');
  if (!open || !asTransition) {
    throw new Error('[as-select-content] missing captured Select or Transition handles.');
  }
  return { stateHandles: { open }, asTransition };
}

function setupSelectContent(
  def: DefHandle<SelectContentProps, SelectContentExposes>,
  _options?: void,
  api?: { store: Record<string, unknown> }
): void {
  def.anatomy.claim(SELECT_FAMILY, { role: 'content' });
  def.props.define({
    side: { type: 'enum', empty: 'fallback', options: ['top', 'right', 'bottom', 'left'] },
    align: { type: 'enum', empty: 'fallback', options: ['start', 'center', 'end'] },
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
    collisionPadding: 10,
  });

  const contentId = def.state.string('selectContentId', '');
  const orientation = def.state.string('selectOrientation', 'vertical');
  def.a11y.id(contentId);
  def.a11y.role('listbox');
  def.a11y.state('orientation', orientation);

  const focusScope = asFocusScope<SelectContentProps>();
  focusScope.configure({ entry: 'manual', restore: 'none' });
  const focusRoving = asFocusRoving<SelectContentProps>();
  focusRoving.configure({ navigation: 'arrow', orientation: 'vertical', entry: 'manual' });
  def.expose.method('focusFirst', () => focusRoving.focusFirst());
  def.expose.method('focusLast', () => focusRoving.focusLast());
  def.expose.method('focusNext', () => focusRoving.focusNext());
  def.expose.method('focusPrev', () => focusRoving.focusPrev());
  def.expose.method('focusSelected', () => focusRoving.focusSelected());

  const overlay = asOverlay<SelectContentProps>();
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
    collisionPadding: 10,
    portal: true,
    modal: false,
    layerRole: 'select-content',
    meta: { overlayKind: 'select' },
  });
  const boundary = asBoundary();
  boundary.observe('pointer.press');

  const transition = asTransition();
  transition.configure({ enterDuration: 0, leaveDuration: 0 });
  overlay.bindPresence({
    enter: transition.controls.enter,
    leave: transition.controls.leave,
    present: transition.isPresent,
  });

  const open = def.state.bool('open', false);
  def.expose.state('open', open);
  const store = (api?.store ?? {}) as { run: any };
  store.run = null;
  let currentContext: SelectContextValue | null = null;
  let entryTask: { cancel(): void } | null = null;

  const readContext = (run: any): SelectContextValue | null => {
    try {
      return run.context.read(SELECT_CONTEXT);
    } catch (error) {
      if ((error as { code?: string })?.code === 'CONTEXT_DISCONNECTED') return null;
      throw error;
    }
  };

  const getNavigationEntries = (run: any) =>
    run.anatomy.order
      .partsOf(SELECT_FAMILY, 'item')
      .map((item: any) => ({
        snapshot: item.getExpose('getCollectionItem')?.() as Record<string, unknown> | undefined,
        focusSelf: item.getExpose('focusSelf') as
          | ((options?: {
              reason?: 'programmatic' | 'keyboard' | 'pointer';
              preventScroll?: boolean;
              defer?: boolean;
            }) => void)
          | null,
        focused: !!(item.getExpose('focused') as { get?: () => boolean } | null)?.get?.(),
      }))
      .filter((entry: any) => entry.snapshot?.disabled !== true);

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
    onMatch: (_run, entry: any) => entry.focusSelf?.({ reason: 'keyboard', preventScroll: true }),
  });

  const focusValue = (
    run: any,
    candidateValue: string,
    options: {
      reason: 'keyboard' | 'pointer' | 'programmatic';
      preventScroll: boolean;
      defer: boolean;
    }
  ) => {
    if (!candidateValue) return false;
    const entry = getNavigationEntries(run).find(
      (candidate: any) => String(candidate.snapshot?.value ?? '') === candidateValue
    );
    if (!entry?.focusSelf) return false;
    entry.focusSelf(options);
    return true;
  };

  const resolveOpenFocusAction = (run: any, ctx: SelectContextValue) => {
    const options = {
      defer: true,
      preventScroll: true,
      reason: ctx.requestFocusReason ?? ('programmatic' as const),
    };
    if (focusValue(run, ctx.value, options)) return;
    if (ctx.requestEntry === 'selected-or-last') {
      focusRoving.focusLast(options);
      return;
    }
    focusRoving.focusFirst(options);
  };

  const scheduleOpenFocusAction = (run: any) => {
    entryTask?.cancel();
    entryTask = delay(0, () => {
      entryTask = null;
      const ctx = readContext(run);
      if (!ctx?.open || !open.get()) return;
      resolveOpenFocusAction(run, ctx);
    });
  };

  const syncPosition = (run: any) => {
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

  const focusTrigger = (run: any, reason: 'keyboard' | 'pointer' | 'programmatic') => {
    const trigger = run.anatomy.partsOf(SELECT_FAMILY, 'trigger')[0] ?? null;
    const focusSelf = trigger?.getExpose('focusSelf') as
      | ((options?: { reason?: 'keyboard' | 'pointer' | 'programmatic' }) => void)
      | null;
    focusSelf?.({ reason });
  };

  def.props.watch(
    ['side', 'align', 'sideOffset', 'alignOffset', 'avoidCollisions', 'collisionPadding'],
    (run) => syncPosition(run)
  );

  const updateOpen = (run: any, ctx: SelectContextValue, reason: string) => {
    const wasOpen = open.get();
    currentContext = ctx;
    contentId.set(createSelectContentId(ctx.rootId), 'reason: select content identity sync');
    open.set(ctx.open, reason);
    if (ctx.open) {
      overlay.openOverlay(reason);
      if (!wasOpen) {
        focusScope.activate({ reason: ctx.requestFocusReason ?? 'programmatic' });
        scheduleOpenFocusAction(run);
      }
      return;
    }
    entryTask?.cancel();
    entryTask = null;
    if (wasOpen) focusScope.deactivate({ reason: ctx.requestFocusReason ?? 'programmatic' });
    overlay.close(reason);
    if (wasOpen && (ctx.requestReason === 'escape' || ctx.requestReason === 'item.select')) {
      focusTrigger(run, ctx.requestFocusReason ?? 'programmatic');
    }
  };

  def.context.subscribe(SELECT_CONTEXT, (run, next) => {
    updateOpen(run, next, 'reason: select context sync => content open');
  });
  def.lifecycle.onCreated((run) => {
    const ctx = readContext(run);
    if (!ctx) return;
    currentContext = ctx;
    contentId.set(createSelectContentId(ctx.rootId), 'reason: select content identity init');
    syncPosition(run);
    updateOpen(run, ctx, 'reason: lifecycle.onCreated => select content sync');
  });
  def.lifecycle.onMounted((run) => {
    store.run = run;
    const trigger = run.anatomy.partsOf(SELECT_FAMILY, 'trigger')[0] ?? null;
    if (trigger) overlay.registerAnchorPart(trigger);
    syncPosition(run);
    const ctx = run.context.read(SELECT_CONTEXT);
    const replayDeferredEntry = ctx.open && open.get();
    updateOpen(run, ctx, 'reason: lifecycle.onMounted => select content sync');
    if (replayDeferredEntry) scheduleOpenFocusAction(run);
  });

  def.anatomy.subscribeParts(SELECT_FAMILY, 'item', (run) => {
    if (entryTask && open.get()) scheduleOpenFocusAction(run);
  });

  overlay.open.watch((_ctx, event) => {
    if (event.type !== 'next' || event.next || event.reason !== 'escape') return;
    const run = store.run;
    const ctx = currentContext;
    if (!run || !ctx?.open) return;
    requestSelectOpen(run, {
      open: false,
      reason: 'escape',
      focusReason: 'keyboard',
    });
    if (ctx.controlledOpen) overlay.openOverlay('controlled.sync');
  });

  def.event.onGlobal('key.down', (run, ev) => {
    if (store.run !== run) return;
    const ctx = readContext(run);
    if (!ctx?.open || ctx.disabled || ev?.key !== 'Tab') return;
    if (!getNavigationEntries(run).some((entry: any) => entry.focused)) return;
    requestSelectOpen(run, { open: false, reason: 'tab', focusReason: 'keyboard' });
  });

  boundary.subscribeOutside(() => {
    const run = store.run;
    const ctx = currentContext;
    if (!run || !ctx?.open || ctx.disabled) return;
    requestSelectOpen(run, { open: false, reason: 'outside.press', focusReason: 'pointer' });
  });

  def.lifecycle.onUnmounted(() => {
    entryTask?.cancel();
    entryTask = null;
    store.run = null;
    currentContext = null;
  });

  def.rule({
    when: (w) => w.state(transition.isPresent).eq(false),
    intent: (i) => i.feedback.style.use(tw('hidden')),
  });
}

export const asSelectContent = defineAsHook<
  SelectContentProps,
  SelectContentExposes,
  SelectContentAsHookContract,
  SelectContentHandles
>({
  name: 'as-select-content',
  setup: setupSelectContent,
  projectHandle: projectSelectContentHandle,
});

const selectContent = definePrototype({
  name: 'base-select-content',
  setup(def) {
    setupSelectContent(def);
    def.feedback.style.use(tw('absolute z-40'));
  },
});

export default selectContent;
