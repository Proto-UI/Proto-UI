import { defineAsHook, definePrototype, delay, tw, type DefHandle } from '@proto.ui/core';
import { asAccessible, asBoundary, asFocusRoving, asFocusScope, asOverlay } from '@proto.ui/hooks';
import { useTypeaheadNavigation } from '../behaviors';
import { createSelectAlignmentController } from './alignment-controller';
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
  const alignmentFull = result.getState?.('alignmentFull');
  if (!open || !asTransition || !alignmentFull) {
    throw new Error('[as-select-content] missing captured Select or Transition handles.');
  }
  return { stateHandles: { open, alignmentFull }, asTransition };
}

function setupSelectContent(
  def: DefHandle<SelectContentProps, SelectContentExposes>,
  _options?: void,
  api?: { store: Record<string, unknown> }
): void {
  const accessible = asAccessible();
  def.anatomy.claim(SELECT_FAMILY, { role: 'content' });
  def.props.define({
    position: { type: 'enum', empty: 'fallback', options: ['popper', 'item-aligned'] },
    side: { type: 'enum', empty: 'fallback', options: ['top', 'right', 'bottom', 'left'] },
    align: { type: 'enum', empty: 'fallback', options: ['start', 'center', 'end'] },
    sideOffset: { type: 'number', empty: 'fallback' },
    alignOffset: { type: 'number', empty: 'fallback' },
    avoidCollisions: { type: 'boolean', empty: 'fallback' },
    collisionPadding: { type: 'number', empty: 'fallback' },
  });
  def.props.setDefaults({
    position: 'popper',
    side: 'bottom',
    align: 'center',
    sideOffset: 4,
    alignOffset: 0,
    avoidCollisions: true,
    collisionPadding: 10,
  });

  const contentId = def.state.string('selectContentId', '');
  const orientation = def.state.string('selectOrientation', 'vertical');
  accessible.id(contentId);
  accessible.role('listbox');
  accessible.state('orientation', orientation);

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

  const open = def.state.bool('open', false);
  def.expose.state('open', open);

  const alignmentFull = def.state.bool('alignmentFull', false);
  const alignmentHidden = def.state.bool('alignmentHidden', true);
  const alignmentDiagnostic = def.state.string('alignmentDiagnostic', '');
  def.expose.state('alignmentDiagnostic', alignmentDiagnostic);
  let alignment: ReturnType<typeof createSelectAlignmentController> | null = null;
  const blocked = () =>
    alignment?.phase === 'structure-invalid' ||
    alignment?.phase === 'unsupported-selection' ||
    alignment?.phase === 'geometry-unavailable';
  const transition = asTransition();
  transition.configure({ coldEntryPreparation: true, enterDuration: 0, leaveDuration: 0 });
  overlay.bindPresence({
    // Overlay dismissal is a request until Root commits it. In particular an
    // Escape request may be refused by a controlled owner without any leave.
    enter: () => {
      if (open.get() && !blocked()) transition.controls.enter();
    },
    leave: () => {
      if (!open.get()) transition.controls.leave();
    },
    present: transition.isPresent,
  });

  const store = (api?.store ?? {}) as { run: any };
  store.run = null;
  let currentContext: SelectContextValue | null = null;
  let ownerDisposed = false;
  let entryTask: { cancel(): void } | null = null;
  let entryCancelled = false;
  const cancelPendingEntry = () => {
    if (ownerDisposed || !open.get()) return;
    entryCancelled = true;
    entryTask?.cancel();
    entryTask = null;
  };
  def.expose.method('__cancelPendingEntry', cancelPendingEntry);

  const readContext = (run: any): SelectContextValue | null => {
    if (ownerDisposed) return null;
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
    if (
      entryCancelled ||
      blocked() ||
      alignment?.phase === 'unsettled' ||
      alignment?.phase === 'full-pending' ||
      alignment?.phase === 'valid'
    )
      return;
    entryTask?.cancel();
    entryTask = delay(0, () => {
      entryTask = null;
      const ctx = readContext(run);
      if (entryCancelled || !ctx?.open || !open.get()) return;
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

  let entryActive = false;
  const isCurrentPresentation = (run: any, ctx: SelectContextValue) => {
    if (currentContext !== ctx) return false;
    const latest = readContext(run);
    return (
      !!latest &&
      latest.open === ctx.open &&
      latest.value === ctx.value &&
      latest.rootId === ctx.rootId &&
      (latest.collectionRevision ?? 0) === (ctx.collectionRevision ?? 0)
    );
  };
  const applyPresentation = (run: any, ctx: SelectContextValue, reason: string) => {
    if (!isCurrentPresentation(run, ctx)) return;
    const ownedEntry = entryActive || transition.isPresent.get();
    const focusedEntry =
      blocked() &&
      run.anatomy
        .partsOf(SELECT_FAMILY, 'item')
        .some(
          (item: import('@proto.ui/core').AnatomyPartView) =>
            (item.getExpose('focused') as { get?: () => boolean } | null)?.get?.() === true
        );
    if (ctx.open && !blocked()) {
      overlay.openOverlay(reason);
      if (!isCurrentPresentation(run, ctx)) return;
      transition.controls.enter();
      if (!isCurrentPresentation(run, ctx)) return;
      const ready =
        alignment?.phase === 'legacy' ||
        alignment?.phase === 'popper' ||
        alignment?.phase === 'valid';
      if (ready && !entryActive) {
        entryActive = true;
        focusScope.activate({ reason: ctx.requestFocusReason ?? 'programmatic' });
        if (!isCurrentPresentation(run, ctx)) return;
        if (alignment?.phase === 'legacy' || alignment?.phase === 'popper')
          scheduleOpenFocusAction(run);
      } else if (!ready) {
        entryTask?.cancel();
        entryTask = null;
        if (entryActive) focusScope.deactivate({ reason: 'programmatic' });
        entryActive = false;
      }
      return;
    }
    entryTask?.cancel();
    entryTask = null;
    if (entryActive) focusScope.deactivate({ reason: ctx.requestFocusReason ?? 'programmatic' });
    entryActive = false;
    if (!isCurrentPresentation(run, ctx)) return;
    const returnFocus = () => {
      if (blocked()) {
        if (focusedEntry) focusTrigger(run, 'programmatic');
      } else if (
        ownedEntry &&
        (ctx.requestReason === 'escape' || ctx.requestReason === 'item.select')
      ) {
        focusTrigger(run, ctx.requestFocusReason ?? 'programmatic');
      }
    };
    // Bound Overlay leave can synchronously retire a preparing view.
    const preparing = transition.transitionState.get() === 'preparing';
    let focusFailed = false;
    let focusError: unknown;
    if (preparing) {
      try {
        returnFocus();
      } catch (error) {
        focusFailed = true;
        focusError = error;
      }
    }
    try {
      if (preparing && !isCurrentPresentation(run, ctx)) return;
      overlay.close(blocked() ? 'select.presentation-abort' : reason);
      if (!isCurrentPresentation(run, ctx)) return;
      transition.controls.leave();
      if (!isCurrentPresentation(run, ctx)) return;
      if (blocked() && transition.transitionState.get() === 'leaving')
        transition.controls.complete();
      if (!isCurrentPresentation(run, ctx)) return;
      if (!preparing) returnFocus();
    } finally {
      if (focusFailed) throw focusError;
    }
  };
  const updateOpen = (run: any, ctx: SelectContextValue, reason: string) => {
    currentContext = ctx;
    if (!ctx.open) entryCancelled = false;
    contentId.set(createSelectContentId(ctx.rootId), 'reason: select content identity sync');
    open.set(ctx.open, reason);
    if (!isCurrentPresentation(run, ctx)) return;
    alignment?.reconcile(run);
    if (!isCurrentPresentation(run, ctx)) return;
    applyPresentation(run, ctx, reason);
  };
  alignment = createSelectAlignmentController({
    overlay,
    changed(run) {
      if (!alignment) return;
      const phase = alignment.phase;
      alignmentFull.set(alignment.surfacePaint, 'reason: select composition');
      if (ownerDisposed || alignment.phase !== phase) return;
      const wasHidden = alignmentHidden.get();
      alignmentHidden.set(
        !['legacy', 'popper', 'valid'].includes(phase),
        'reason: select alignment admission'
      );
      if (ownerDisposed || alignment.phase !== phase) return;
      if (
        !wasHidden &&
        phase === 'full-pending' &&
        transition.transitionState.get() === 'preparing'
      ) {
        transition.controls.leave();
        transition.controls.enter();
        if (ownerDisposed || alignment.phase !== phase) return;
      }
      alignmentDiagnostic.set(alignment.diagnostic, 'reason: select alignment diagnostic');
      if (ownerDisposed || alignment.phase !== phase) return;
      const ctx = readContext(run);
      if (!ctx) return;
      currentContext = ctx;
      applyPresentation(run, ctx, 'select.alignment-admission');
      if ((phase === 'legacy' || phase === 'popper') && ctx.open)
        transition.controls.capturePreparation()?.();
    },
    applied(_run, row, current) {
      if (!current()) return false;
      transition.controls.capturePreparation()?.();
      if (!current()) return false;
      const phase = transition.transitionState.get();
      if (phase !== 'entering' && phase !== 'entered') return false;
      if (entryCancelled) return true;
      const focus = row.getExpose('focusSelf') as
        | ((options: { preventScroll: boolean; defer: boolean; reason: 'programmatic' }) => void)
        | null;
      focus?.({ preventScroll: true, defer: false, reason: 'programmatic' });
      return true;
    },
  });
  transition.transitionState.watch((_run, event) => {
    if (event.type !== 'next') return;
    if (
      event.next === 'preparing' &&
      (alignment?.phase === 'legacy' || alignment?.phase === 'popper')
    )
      transition.controls.capturePreparation()?.();
    if (event.next === 'preparing' || event.next === 'entering' || event.next === 'entered')
      alignment?.deliver();
  });
  def.props.watch(['position'], (run) => alignment?.reconcile(run));
  for (const role of ['surface', 'viewport', 'item', 'item-text', 'trigger', 'value']) {
    def.anatomy.subscribeParts(SELECT_FAMILY, role, (run) => alignment?.structureChanged(run));
  }
  def.lifecycle.onUpdated((run) => alignment?.updated(run));
  def.lifecycle.onBeforeDispose(() => {
    ownerDisposed = true;
    alignment?.dispose();
  });

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
    alignment?.mounted(run);
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
    if (ctx.controlledOpen && currentContext?.open) overlay.openOverlay('controlled.sync');
  });

  boundary.subscribeOutside(() => {
    const run = store.run;
    const ctx = currentContext;
    if (!run || !ctx?.open || ctx.disabled) return;
    requestSelectOpen(run, { open: false, reason: 'outside.press', focusReason: 'pointer' });
  });

  def.lifecycle.onUnmounted(() => {
    alignment?.unmounted();
    entryTask?.cancel();
    entryTask = null;
    store.run = null;
    currentContext = null;
  });

  def.rule({
    when: (w) =>
      w.any(w.state(alignmentHidden).eq(true), w.state(transition.transitionState).eq('preparing')),
    intent: (i) => i.feedback.style.use(tw('invisible pointer-events-none')),
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

const selectContent = definePrototype<SelectContentProps, SelectContentExposes>({
  name: 'base-select-content',
  setup(def) {
    setupSelectContent(def);
    def.feedback.style.use(tw('absolute z-40'));
  },
});

export default selectContent;
