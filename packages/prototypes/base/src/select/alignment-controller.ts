import type { AnatomyPartView, OverlayHandle, RunHandle } from '@proto.ui/core';
import type { SelectContentProps } from './types';
import { SELECT_CONTEXT, SELECT_FAMILY } from './shared';
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
  overlay: Pick<OverlayHandle<SelectContentProps>, 'registerTargetAlignment'>;
  changed(run: Run): void;
  applied(run: Run, row: AnatomyPartView, current: () => boolean): boolean;
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
  let lastItemSizing: 'intrinsic' | 'match-trigger' | undefined;
  let cycle = 0;
  let wasOpen = false;
  let initial = true;
  type InitialFallback = { rootValue: string; candidateValue: string; structureVersion: number };
  let initialFallback: InitialFallback | null = null;
  let applied: {
    id: number;
    run: Run;
    row: AnatomyPartView;
    fallback: InitialFallback | null;
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
    phase = next;
    diagnostic = reason;
    options.changed(run);
  };
  const clear = () => {
    const id = ++request;
    applied = null;
    options.overlay.registerTargetAlignment(null);
    return id;
  };
  let delivering = false;
  const deliver = () => {
    const next = applied;
    if (delivering || !mounted || !next || !next.current()) return;
    delivering = true;
    try {
      const accepted = options.applied(next.run, next.row, () => mounted && next.current());
      if (accepted && next.current()) {
        if (initial) initialFallback = next.fallback;
        initial = false;
        if (applied === next) applied = null;
      }
    } finally {
      delivering = false;
    }
  };
  const reconcile = (run: Run, structural = false) => {
    if (disposed) return;
    const ctx = readContext(run);
    if (!ctx) return;
    const mode = run.props.get().position ?? 'popper';
    const revision = ctx.collectionRevision ?? 0;
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
    if (phase === 'structure-invalid' && !structural && mode !== 'popper') return;
    if (
      phase === 'geometry-unavailable' &&
      !structural &&
      !reopened &&
      revision === lastRevision &&
      ctx.itemSizing === lastItemSizing &&
      mode !== 'popper'
    )
      return;
    const key = `${cycle}:${structureVersion}:${revision}:${mode}:${ctx.value}:${ctx.itemSizing}`;
    if (key === lastKey) return;
    lastKey = key;
    lastRevision = revision;
    lastItemSizing = ctx.itemSizing;
    const id = clear();
    const current = () => {
      if (disposed || id !== request) return false;
      const latest = readContext(run);
      if (!latest) return false;
      return (
        latest.open &&
        latest.value === ctx.value &&
        (latest.collectionRevision ?? 0) === revision &&
        (run.props.get().position ?? 'popper') === mode &&
        latest.itemSizing === ctx.itemSizing
      );
    };
    if (!current()) return;
    const parts = run.anatomy.parts(SELECT_FAMILY);
    const role = (name: string) => parts.filter((part) => part.role === name);
    const surfaces = role('surface'),
      viewports = role('viewport'),
      texts = role('item-text');
    surfacePaint = surfaces.length === 1;
    if (mode === 'popper') {
      if (ctx.itemSizing === 'match-trigger') {
        notify(run, 'geometry-unavailable', 'select.sizing.popper-not-supported');
        return;
      }
      notify(run, 'popper');
      return;
    }
    if (!surfaces.length && !viewports.length && !texts.length) {
      notify(run, 'legacy');
      return;
    }
    const triggers = role('trigger'),
      values = role('value');
    if (
      surfaces.length !== 1 ||
      viewports.length !== 1 ||
      triggers.length !== 1 ||
      values.length !== 1
    ) {
      notify(run, 'structure-invalid', 'select.structure.missing-or-ambiguous-parts');
      return;
    }
    const rows = run.anatomy.order.partsOf(SELECT_FAMILY, 'item');
    const records = rows.map((row) => {
      const snapshot = (
        row.getExpose('getCollectionItem') as
          | (() => { value: string; disabled: boolean; itemSizing?: 'inherit' | 'intrinsic' })
          | null
      )?.();
      const text = run.anatomy.descendantsOf(SELECT_FAMILY, row, 'item-text');
      return {
        value: snapshot?.value ?? '',
        disabled: snapshot?.disabled ?? true,
        row,
        itemSizing: snapshot?.itemSizing ?? 'inherit',
        text: text.length === 1 ? text[0] : null,
      };
    });
    if (!current()) return;
    if (records.some((record) => !record.text)) {
      notify(run, 'structure-invalid', 'select.structure.missing-or-ambiguous-item-text');
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
    notify(run, 'full-pending');
    if (!current()) return;
    const sizeRows =
      ctx.itemSizing === 'match-trigger'
        ? records.filter((record) => record.itemSizing !== 'intrinsic').map((record) => record.row)
        : [];
    const selectedMatches = sizeRows.includes(intent.floating.block);
    options.overlay.registerTargetAlignment({
      family: SELECT_FAMILY,
      surface: surfaces[0],
      scrollport: viewports[0],
      blockReference: intent.reference.block,
      inlineReference: selectedMatches ? intent.reference.block : intent.reference.inline,
      blockTarget: intent.floating.block,
      inlineTarget: selectedMatches ? intent.floating.block : intent.floating.inline,
      ...(sizeRows.length ? { sizeMatch: { reference: triggers[0], targets: sizeRows } } : {}),
      ...intent.contentEdges,
      constraints: intent.constraints,
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
        applied = { id, run, row: intent.floating.block, fallback, current };
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
    reconcile,
    deliver,
    structureChanged(run: Run) {
      ++structureVersion;
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
    },
    dispose() {
      disposed = true;
      clear();
    },
  };
}
