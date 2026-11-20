import { defineAsHook, definePrototype, delay, tw, type DefHandle } from '@proto.ui/core';
import type { AnatomyPartView, AsHookResult, RunHandle } from '@proto.ui/core';
import { asAccessible, asBoundary, asFocusRoving, asFocusScope, asOverlay } from '@proto.ui/hooks';
import { useTypeaheadNavigation } from '../behaviors';
import { createSelectAlignmentController } from './alignment-controller';
import { asTransition } from '../tools';
import {
  createSelectContentId,
  requestSelectOpen,
  retireSelectFocusHandoff,
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
  result: AsHookResult<SelectContentProps, SelectContentAsHookContract>
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
  let presentationAborted = false;
  type EntryFocusAttempt = {
    target: AnatomyPartView;
    opening: SelectContextValue;
    handoff: number;
    applying: boolean;
  };
  let entryFocus: EntryFocusAttempt | null = null;
  const cancelEntryFocus = () => {
    const attempt = entryFocus;
    if (!attempt) return;
    entryFocus = null;
    const cancel = attempt.target.getExpose('__cancelPendingEntryFocus') as (() => void) | null;
    cancel?.();
  };
  const cancelPendingEntry = () => {
    if (ownerDisposed || !open.get()) return;
    entryCancelled = true;
    entryTask?.cancel();
    entryTask = null;
    cancelEntryFocus();
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
        part: item as AnatomyPartView,
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
    onMatch: (run, entry: any) =>
      entry.focusSelf?.({
        reason: 'keyboard',
        preventScroll: run.props.get().position === 'item-aligned',
      }),
  });

  const focusValue = (
    run: RunHandle<SelectContentProps>,
    candidateValue: string,
    options: {
      reason: 'keyboard' | 'pointer' | 'programmatic';
      preventScroll: boolean;
      defer: boolean;
    },
    current: () => boolean
  ) => {
    if (!candidateValue) return null;
    const entry = getNavigationEntries(run).find(
      (candidate: any) => String(candidate.snapshot?.value ?? '') === candidateValue
    );
    if (!entry?.focusSelf) return null;
    if (options.defer) entry.focusSelf(options);
    else applyEntryFocus(run, entry.part, () => entry.focusSelf(options), current);
    return entry.part;
  };

  const resolveOpenFocusAction = (
    run: RunHandle<SelectContentProps>,
    ctx: SelectContextValue,
    defer: boolean,
    current: () => boolean
  ) => {
    const options = {
      defer,
      // Popper has no alignment-owned scroll request. Let the host reveal its
      // selected/boundary option; item-aligned already positions that row and
      // must keep the scroll offset established by its geometry lease.
      preventScroll: run.props.get().position === 'item-aligned',
      reason: ctx.requestFocusReason ?? ('programmatic' as const),
    };
    const selected = focusValue(run, ctx.value, options, current);
    if (selected) return selected;
    const entries = getNavigationEntries(run);
    if (ctx.requestEntry === 'selected-or-last') {
      const target = entries.at(-1)?.part ?? null;
      if (defer || !target) focusRoving.focusLast(options);
      else applyEntryFocus(run, target, () => focusRoving.focusLast(options), current);
      return entries.at(-1)?.part ?? null;
    }
    const target = entries[0]?.part ?? null;
    if (defer || !target) focusRoving.focusFirst(options);
    else applyEntryFocus(run, target, () => focusRoving.focusFirst(options), current);
    return entries[0]?.part ?? null;
  };

  const retireFocusHandoff = (
    run: RunHandle<SelectContentProps>,
    ctx: SelectContextValue,
    handoff = ctx.focusHandoff ?? 0
  ) => {
    if (handoff <= (ctx.focusHandoffBaseline ?? 0)) return;
    run.context.update(SELECT_CONTEXT, (latest: SelectContextValue) =>
      latest.rootId === ctx.rootId && latest.open === ctx.open && latest.value === ctx.value
        ? retireSelectFocusHandoff(latest, handoff)
        : latest
    );
  };

  const finishEntryFocus = (run: RunHandle<SelectContentProps>, attempt: EntryFocusAttempt) => {
    if (entryFocus !== attempt) return;
    entryFocus = null;
    const { opening, handoff } = attempt;
    if (!ownerDisposed && handoff > (opening.focusHandoff ?? 0))
      retireFocusHandoff(run, opening, handoff);
  };

  const applyEntryFocus = (
    run: RunHandle<SelectContentProps>,
    target: AnatomyPartView,
    focus: () => void,
    current: () => boolean
  ) => {
    if (!current()) return;
    if (entryFocus && !entryFocus.applying) cancelEntryFocus();
    const opening = readContext(run);
    if (!opening || !current()) return;
    const attempt = { target, opening, handoff: opening.focusHandoff ?? 0, applying: true };
    entryFocus = attempt;
    try {
      focus();
    } catch (error) {
      if (entryFocus === attempt) entryFocus = null;
      throw error;
    } finally {
      attempt.applying = false;
    }
    if (
      attempt.handoff > (opening.focusHandoff ?? 0) ||
      (target.getExpose('focused') as { get?: () => boolean } | null)?.get?.()
    )
      finishEntryFocus(run, attempt);
    // Focus can retain this target for a host-readiness retry. Keep its
    // identity until the focus fact or a newer owner arrives.
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
      resolveOpenFocusAction(run, ctx, true, () => !ownerDisposed && open.get());
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
    if (!blocked()) presentationAborted = false;
    else if (!presentationAborted) {
      presentationAborted = true;
      cancelEntryFocus();
      if (!isCurrentPresentation(run, ctx)) return;
      // Root owns retirement so replacement Content cannot revive this token.
      // Retire only the observed token, preserving any newer reentrant handoff.
      retireFocusHandoff(run, ctx);
      if (!isCurrentPresentation(run, ctx)) return;
    }
    const ownedEntry = entryActive || transition.isPresent.get();
    const focusedEntry =
      blocked() &&
      run.anatomy
        .partsOf(SELECT_FAMILY, 'item')
        .some(
          (item: AnatomyPartView) =>
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
        // Size remeasurement is not withdrawal of an already accepted entry.
        // Deactivating here clears the shared focused/active owner even when
        // native focus never moved; activating a manual scope cannot restore it.
        if (!alignment?.retainsPendingFocusScope) {
          if (entryActive) focusScope.deactivate({ reason: 'programmatic' });
          entryActive = false;
        }
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
    applied(_run, row, current, admission) {
      if (!current()) return false;
      transition.controls.capturePreparation()?.();
      if (!current()) return false;
      const phase = transition.transitionState.get();
      if (phase !== 'entering' && phase !== 'entered') return false;
      // Commit only current, usable readiness before a focus callback can reenter.
      if (!admission.accept()) return false;
      // Readiness and focus admission are separate: a sizing-only refresh must
      // not replace a newer Item or external Focus owner after entry completed.
      if (entryCancelled || admission.preserveFocus) return true;
      if (!row) {
        entryTask?.cancel();
        entryTask = delay(0, () => {
          entryTask = null;
          if (entryCancelled || !current()) return;
          const ctx = readContext(_run);
          if (!ctx || (ctx.focusHandoff ?? 0) > (ctx.focusHandoffBaseline ?? 0)) return;
          if (!current()) return;
          resolveOpenFocusAction(_run, ctx, false, current);
        });
        return true;
      }
      const focus = row.getExpose('focusSelf') as
        | ((options: { preventScroll: boolean; defer: boolean; reason: 'programmatic' }) => void)
        | null;
      if (!current()) return false;
      applyEntryFocus(
        _run,
        row,
        () => focus?.({ preventScroll: true, defer: false, reason: 'programmatic' }),
        current
      );
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
    cancelEntryFocus();
    alignment?.dispose();
  });

  def.context.subscribe(SELECT_CONTEXT, (run, next) => {
    const attempt = entryFocus;
    if (attempt) {
      if (
        !next.open ||
        next.rootId !== attempt.opening.rootId ||
        next.value !== attempt.opening.value
      ) {
        cancelEntryFocus();
      } else if ((next.focusHandoff ?? 0) > attempt.handoff) {
        if ((attempt.target.getExpose('focused') as { get?: () => boolean } | null)?.get?.()) {
          attempt.handoff = next.focusHandoff ?? 0;
          // Synchronous host callbacks can still change the collection. A
          // readiness replay completes via this observation instead.
          if (!attempt.applying) finishEntryFocus(run, attempt);
        } else {
          cancelEntryFocus();
        }
      }
    }
    updateOpen(run, readContext(run) ?? next, 'reason: select context sync => content open');
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
    cancelEntryFocus();
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
