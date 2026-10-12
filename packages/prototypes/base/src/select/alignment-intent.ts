import type { AnatomyPartView, AnchoredPositionConfig } from '@proto.ui/core';

/** P-BASE-SELECT-CONTENT-INITIAL-ALIGNMENT-INTENT. Pure initial-registration policy used by the private Content owner. */
export type InitialSelectAlignmentInput = Readonly<{
  mode: 'popper' | 'item-aligned';
  edge: AnchoredPositionConfig;
  phase: 'initial-settled' | 'unsettled' | 'open-update';
  committed: Readonly<{ kind: 'unset' }> | Readonly<{ kind: 'value'; value: string }>;
  records: readonly Readonly<{
    value: string;
    disabled: boolean;
    row: AnatomyPartView | null;
    text: AnatomyPartView | null;
  }>[];
  reference: Readonly<{ trigger: AnatomyPartView | null; value: AnatomyPartView | null }>;
}>;

// Source profile constants are declared here by semantic policy, never hidden host defaults.
export const INITIAL_SELECT_ALIGNMENT_CONSTRAINTS = Object.freeze({
  boundary: 'layout-viewport',
  margin: 10,
  minimumTargetSpanCount: 5,
  inlineOverflow: 'preserve-start' as const,
  expandOnScroll: true,
});

export type InitialSelectAlignmentIntent =
  | Readonly<{ kind: 'edge'; config: AnchoredPositionConfig }>
  | Readonly<{
      kind: 'target-pair';
      reference: Readonly<{ inline: AnatomyPartView; block: AnatomyPartView }>;
      floating: Readonly<{ inline: AnatomyPartView; block: AnatomyPartView }>;
      contentEdges: Readonly<{ atStart: boolean; atEnd: boolean }>;
      constraints: typeof INITIAL_SELECT_ALIGNMENT_CONSTRAINTS;
    }>
  | Readonly<{
      kind: 'unresolved';
      reason:
        | 'unsettled'
        | 'open-update-compatibility'
        | 'empty-collection'
        | 'duplicate-value'
        | 'disabled-selected-compatibility'
        | 'all-disabled'
        | 'missing-row'
        | 'missing-text'
        | 'missing-reference';
    }>;

type UnresolvedReason = Extract<InitialSelectAlignmentIntent, { kind: 'unresolved' }>['reason'];
const unresolved = (reason: UnresolvedReason): InitialSelectAlignmentIntent =>
  Object.freeze({ kind: 'unresolved', reason });

export function resolveInitialSelectAlignment(
  input: InitialSelectAlignmentInput
): InitialSelectAlignmentIntent {
  if (input.mode === 'popper') return Object.freeze({ kind: 'edge', config: input.edge });
  if (input.phase === 'unsettled') return unresolved('unsettled');
  if (input.phase !== 'initial-settled') return unresolved('open-update-compatibility');
  if (input.records.length === 0) return unresolved('empty-collection');
  const values = new Set<string>();
  for (const record of input.records) {
    if (values.has(record.value)) return unresolved('duplicate-value');
    values.add(record.value);
  }
  const committed = input.committed;
  const match =
    committed.kind === 'value'
      ? input.records.find((record) => record.value === committed.value)
      : undefined;
  if (match?.disabled) return unresolved('disabled-selected-compatibility');
  const candidate = match ?? input.records.find((record) => !record.disabled);
  if (!candidate) return unresolved('all-disabled');
  if (!candidate.row) return unresolved('missing-row');
  if (!candidate.text) return unresolved('missing-text');
  if (!input.reference.trigger || !input.reference.value) return unresolved('missing-reference');
  return Object.freeze({
    kind: 'target-pair',
    reference: Object.freeze({ inline: input.reference.value, block: input.reference.trigger }),
    floating: Object.freeze({ inline: candidate.text, block: candidate.row }),
    contentEdges: Object.freeze({
      atStart: candidate === input.records[0],
      atEnd: candidate === input.records[input.records.length - 1],
    }),
    constraints: INITIAL_SELECT_ALIGNMENT_CONSTRAINTS,
  });
}

/** P-BASE-SELECT-CONTENT-CURRENT-ALIGNMENT-INTENT.
 * A represented value replacement is not another initial-registration fallback.
 */
export function resolveCurrentSelectAlignment(
  input: InitialSelectAlignmentInput
): InitialSelectAlignmentIntent {
  if (input.mode === 'popper') return Object.freeze({ kind: 'edge', config: input.edge });
  if (input.phase !== 'open-update') return unresolved('unsettled');
  const committed = input.committed;
  if (
    committed.kind !== 'value' ||
    !input.records.some((record) => record.value === committed.value)
  ) {
    return unresolved('open-update-compatibility');
  }
  return resolveInitialSelectAlignment({ ...input, phase: 'initial-settled' });
}
