import type { AnatomyPartView, OverlayHandle, RunHandle } from '@proto.ui/core';
import type { SelectContentProps } from './types';
import {
  SELECT_CONTEXT,
  SELECT_FAMILY,
  normalizeSelectRootItemSizing,
  normalizeSelectItemSizing,
} from './shared';
import { resolveCurrentSelectAlignment, resolveInitialSelectAlignment } from './alignment-intent';

type Run = RunHandle<SelectContentProps>;
export type SelectPresentationPhase =
  | 'unsettled'
  | 'legacy'
  | 'popper'
  | 'full-pending'
  | 'valid'
  | 'structure-invalid'
  | 'unsupported-selection'
  | 'geometry-unavailable';

/** Private semantic controller; Content alone applies presence, gate and focus effects. */
export function createSelectAlignmentController(options: {
  overlay: Pick<OverlayHandle<SelectContentProps>, 'registerTargetAlignment' | 'registerSizeMatch'>;
  changed(run: Run): void;
  applied(
    run: Run,
    row: AnatomyPartView | null,
    current: () => boolean,
    admission: {
      preserveFocus: boolean;
      accept(): boolean;
    }
  ): void;
}) {
  let phase: SelectPresentationPhase = 'unsettled';
  let diagnostic = '';
  let surfacePaint = false;
  let settled = false;
  let mounted = false;
  let disposed = false;
  let structureVersion = 0;
  let structureDirty = true;
  let request = 0;
  let lastKey = '';
  let lastRevision = -1;
  let lastSizing: 'intrinsic' | 'match-trigger' = 'intrinsic';
  let cycle = 0;
  let wasOpen = false;
  let initial = true;
  // A policy-only remeasurement confirms layout without acquiring a new entry-focus right.
  // Retain only semantic scalars and structural generation, never DOM targets or measurements.
  type FocusShape = string;
  let lastAcceptedFocusShape: FocusShape | null = null;
  let lastObservedFocusValue: string | null = null;
  let lastObservedFocusMode: string | null = null;
  type InitialFallback = { rootValue: string; candidateValue: string; structureVersion: number };
  let initialFallback: InitialFallback | null = null;
  let applied: {
    id: number;
    run: Run;
    row: AnatomyPartView | null;
    fallback: InitialFallback | null;
    focusShape: FocusShape;
    preserveFocus: boolean;
    current(): boolean;
  } | null = null;

  const readContext = (run: Run) => {
    try {
      return run.context.read(SELECT_CONTEXT);
    } catch (error) {
      if ((error as { code?: string })?.code === 'CONTEXT_DISCONNECTED') return null;
      throw error;
    }
  };
  const notify = (run: Run, next: SelectPresentationPhase, reason = '') => {
    // An aborted presentation cannot lend its old entry rights to a later repair.
    if (next !== 'valid' && next !== 'full-pending') lastAcceptedFocusShape = null;
    phase = next;
    diagnostic = reason;
    options.changed(run);
  };
  const clear = () => {
    const id = ++request;
    applied = null;
    options.overlay.registerTargetAlignment(null);
    options.overlay.registerSizeMatch(null);
    return id;
  };
  let delivering = false;
  const deliver = () => {
    const next = applied;
    if (delivering || !mounted || !next || !next.current()) return;
    delivering = true;
    let completedNormally = false;
    try {
      let accepted = false;
      options.applied(next.run, next.row, () => mounted && next.current(), {
        preserveFocus: next.preserveFocus,
        accept() {
          if (!mounted || !next.current()) return false;
          if (accepted) return true;
          accepted = true;
          // Content confirms readiness before any focus callback can reenter.
          lastAcceptedFocusShape = next.focusShape;
          if (initial) initialFallback = next.fallback;
          initial = false;
          if (applied === next) applied = null;
          return true;
        },
      });
      completedNormally = true;
    } finally {
      delivering = false;
      // A focus callback may synchronously complete a newer request. Drain only
      // that successor, never spin the same rejected admission or replace an error.
      if (completedNormally && applied && applied !== next) deliver();
    }
  };
  const reconcile = (run: Run, structural = false) => {
    if (disposed) return;
    const ctx = readContext(run);
    if (!ctx) return;
    const mode = run.props.get().position ?? 'popper';
    // A semantic excursion retires the old focus exemption immediately, even
    // when its request stays pending or cannot be admitted. Returning to an old
    // value later is a genuine value replacement, not a sizing-only refresh.
    if (ctx.value !== lastObservedFocusValue || mode !== lastObservedFocusMode)
      lastAcceptedFocusShape = null;
    lastObservedFocusValue = ctx.value;
    lastObservedFocusMode = mode;
    const revision = ctx.collectionRevision ?? 0;
    const itemSizing = normalizeSelectRootItemSizing(ctx.itemSizing);
    if (
      initialFallback &&
      (mode !== 'item-aligned' ||
        initialFallback.rootValue !== ctx.value ||
        initialFallback.structureVersion !== structureVersion)
    ) {
      initialFallback = null;
    }
    if (!ctx.open) {
      if (wasOpen) clear();
      wasOpen = false;
      initial = true;
      initialFallback = null;
      lastAcceptedFocusShape = null;
      lastKey = '';
      return;
    }
    const reopened = !wasOpen;
    if (!wasOpen) {
      wasOpen = true;
      ++cycle;
      initial = true;
    }
    if (!settled) return;
    const restoresIntrinsicLegacy =
      diagnostic === 'select.structure.missing-size-parts' && itemSizing === 'intrinsic';
    if (
      phase === 'structure-invalid' &&
      !structural &&
      mode !== 'popper' &&
      !restoresIntrinsicLegacy
    )
      return;
    if (
      phase === 'geometry-unavailable' &&
      !(diagnostic === 'select.geometry.unsupported-size-mode' && mode === 'item-aligned') &&
      !structural &&
      !reopened &&
      revision === lastRevision &&
      itemSizing === lastSizing &&
      mode !== 'popper'
    )
      return;
    const key = `${cycle}:${structureVersion}:${revision}:${mode}:${itemSizing}:${ctx.value}`;
    if (key === lastKey) return;
    lastKey = key;
    lastRevision = revision;
    lastSizing = itemSizing;
    const id = clear();
    const current = () => {
      if (disposed || id !== request) return false;
      const latest = readContext(run);
      if (!latest) return false;
      return (
        latest.open &&
        latest.value === ctx.value &&
        (latest.collectionRevision ?? 0) === revision &&
        normalizeSelectRootItemSizing(latest.itemSizing) === itemSizing &&
        (run.props.get().position ?? 'popper') === mode
      );
    };
    if (!current()) return;
    const parts = run.anatomy.parts(SELECT_FAMILY);
    const role = (name: string) => parts.filter((part) => part.role === name);
    const triggers = role('trigger');
    const surfaces = role('surface'),
      viewports = role('viewport'),
      texts = role('item-text');
    surfacePaint = surfaces.length === 1;
    if (mode === 'popper' && (surfaces.length !== 1 || triggers.length !== 1)) {
      notify(
        run,
        itemSizing === 'match-trigger' ? 'structure-invalid' : 'popper',
        itemSizing === 'match-trigger' ? 'select.structure.missing-size-parts' : ''
      );
      return;
    }
    if (mode !== 'popper' && !surfaces.length && !viewports.length && !texts.length) {
      if (itemSizing === 'match-trigger') {
        notify(run, 'structure-invalid', 'select.structure.missing-size-parts');
      } else {
        notify(run, 'legacy');
      }
      return;
    }
    const values = role('value');
    if (
      mode !== 'popper' &&
      (surfaces.length !== 1 ||
        viewports.length !== 1 ||
        triggers.length !== 1 ||
        values.length !== 1)
    ) {
      notify(run, 'structure-invalid', 'select.structure.missing-or-ambiguous-parts');
      return;
    }
    const rows = run.anatomy.order.partsOf(SELECT_FAMILY, 'item');
    const records = rows.map((row) => {
      const snapshot = (
        row.getExpose('getCollectionItem') as
          | (() => { value: string; textValue?: unknown; disabled: boolean; itemSizing?: unknown })
          | null
      )?.();
      const text = run.anatomy.descendantsOf(SELECT_FAMILY, row, 'item-text');
      return {
        value: snapshot?.value ?? '',
        textValue: String(snapshot?.textValue ?? ''),
        disabled: snapshot?.disabled ?? true,
        itemSizing: normalizeSelectItemSizing(snapshot?.itemSizing),
        row,
        text: text.length === 1 ? text[0] : null,
      };
    });
    if (!current()) return;
    // Anatomy wrappers are fresh views, not identities. Structural generation
    // and ordered non-sizing scalars must remain continuously unchanged.
    const focusShape: FocusShape = JSON.stringify([
      cycle,
      structureVersion,
      ctx.rootId,
      ctx.value,
      mode,
      records.map(({ value, textValue, disabled }) => [value, textValue, disabled]),
    ]);
    if (lastAcceptedFocusShape !== focusShape) lastAcceptedFocusShape = null;
    if (mode !== 'popper' && records.some((record) => !record.text)) {
      notify(run, 'structure-invalid', 'select.structure.missing-or-ambiguous-item-text');
      return;
    }
    if (mode === 'popper') {
      const preserveFocus = !initial && lastAcceptedFocusShape === focusShape;
      const complete = () => {
        if (!current() || phase === 'valid') return;
        notify(run, 'valid');
        if (!current()) return;
        applied = { id, run, row: null, fallback: null, focusShape, preserveFocus, current };
        deliver();
      };
      const targets =
        itemSizing === 'match-trigger'
          ? records.filter((record) => record.itemSizing === 'inherit').map((record) => record.row)
          : [];
      notify(run, 'full-pending');
      if (!current()) return;
      if (!targets.length) {
        // Semantic readiness only: no invented physical size result.
        complete();
        return;
      }
      options.overlay.registerSizeMatch({
        family: SELECT_FAMILY,
        surface: surfaces[0],
        reference: triggers[0],
        targets,
        onSizeMatch(status) {
          if (!current() || status.status === 'pending-target') return;
          if (status.status === 'unavailable') {
            clear();
            notify(
              run,
              status.reason === 'invalid-association'
                ? 'structure-invalid'
                : 'geometry-unavailable',
              `select.${status.reason === 'invalid-association' ? 'structure' : 'geometry'}.${status.reason}`
            );
            return;
          }
          complete();
        },
      });
      return;
    }
    const retainedFallback =
      !initial &&
      initialFallback &&
      initialFallback.rootValue === ctx.value &&
      initialFallback.structureVersion === structureVersion
        ? initialFallback
        : null;
    const input = {
      mode,
      phase: initial ? ('initial-settled' as const) : ('open-update' as const),
      edge: {
        side: 'bottom' as const,
        align: 'center' as const,
        sideOffset: 4,
        alignOffset: 0,
        avoidCollisions: true,
        collisionBoundary: 'viewport' as const,
        collisionPadding: 10,
        strategy: 'fixed' as const,
      },
      committed: retainedFallback
        ? { kind: 'value' as const, value: retainedFallback.candidateValue }
        : ctx.value
          ? { kind: 'value' as const, value: ctx.value }
          : { kind: 'unset' as const },
      records,
      reference: { trigger: triggers[0], value: values[0] },
    };
    const intent = initial
      ? resolveInitialSelectAlignment(input)
      : resolveCurrentSelectAlignment(input);
    if (intent.kind !== 'target-pair') {
      const reason = intent.kind === 'unresolved' ? intent.reason : 'unexpected-edge';
      const structuralFailure = ['missing-row', 'missing-text', 'missing-reference'].includes(
        reason
      );
      notify(
        run,
        structuralFailure ? 'structure-invalid' : 'unsupported-selection',
        `select.${structuralFailure ? 'structure' : 'selection'}.${reason}`
      );
      return;
    }
    const firstEnabled = records.find((record) => !record.disabled);
    const fallback =
      initial &&
      (!ctx.value || !records.some((record) => record.value === ctx.value)) &&
      firstEnabled
        ? { rootValue: ctx.value, candidateValue: firstEnabled.value, structureVersion }
        : null;
    const preserveFocus = !initial && lastAcceptedFocusShape === focusShape;
    notify(run, 'full-pending');
    if (!current()) return;
    const sizeTargets =
      itemSizing === 'match-trigger'
        ? records.filter((record) => record.itemSizing === 'inherit').map((record) => record.row)
        : [];
    const selectedMatches = sizeTargets.includes(intent.floating.block);
    options.overlay.registerTargetAlignment({
      family: SELECT_FAMILY,
      surface: surfaces[0],
      scrollport: viewports[0],
      blockReference: intent.reference.block,
      inlineReference: selectedMatches ? triggers[0] : intent.reference.inline,
      blockTarget: intent.floating.block,
      inlineTarget: selectedMatches ? intent.floating.block : intent.floating.inline,
      ...intent.contentEdges,
      constraints: intent.constraints,
      ...(sizeTargets.length
        ? { sizeMatch: { reference: triggers[0], targets: sizeTargets } }
        : {}),
      onAlignment(status) {
        if (!current()) return;
        if (status.status === 'pending-target') return;
        if (status.status === 'unavailable') {
          clear();
          notify(
            run,
            status.reason === 'invalid-association' ? 'structure-invalid' : 'geometry-unavailable',
            `select.${status.reason === 'invalid-association' ? 'structure' : 'geometry'}.${status.reason}`
          );
          return;
        }
        if (phase === 'valid') return;
        notify(run, 'valid');
        if (!current()) return;
        applied = {
          id,
          run,
          row: intent.floating.block,
          fallback,
          focusShape,
          preserveFocus,
          current,
        };
        deliver();
      },
    });
  };
  return {
    get phase() {
      return phase;
    },
    get surfacePaint() {
      return surfacePaint;
    },
    get diagnostic() {
      return diagnostic;
    },
    get retainsPendingFocusScope() {
      // Before full-pending, reconcile checked the current ordered non-sizing
      // shape against the last accepted entry. No new focus request is granted.
      return phase === 'full-pending' && lastAcceptedFocusShape !== null;
    },
    reconcile,
    deliver,
    structureChanged(run: Run) {
      ++structureVersion;
      lastAcceptedFocusShape = null;
      structureDirty = true;
      reconcile(run, true);
    },
    mounted(run: Run) {
      if (disposed) return;
      mounted = true;
      run.update();
      deliver();
    },
    updated(run: Run) {
      if (disposed) return;
      const structural = !settled || structureDirty;
      settled = true;
      structureDirty = false;
      reconcile(run, structural);
    },
    unmounted() {
      mounted = false;
      // Blocked admission can recover through an explicit structural or policy repair.
      if (!['structure-invalid', 'unsupported-selection', 'geometry-unavailable'].includes(phase))
        settled = false;
      ++request;
      lastKey = '';
      applied = null;
      lastAcceptedFocusShape = null;
    },
    dispose() {
      disposed = true;
      lastAcceptedFocusShape = null;
      clear();
    },
  };
}
