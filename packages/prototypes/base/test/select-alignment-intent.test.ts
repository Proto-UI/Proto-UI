// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AnatomyPartView, AnchoredPositionConfig } from '@proto.ui/core';
import {
  resolveInitialSelectAlignment,
  resolveCurrentSelectAlignment,
  type InitialSelectAlignmentInput,
} from '../src/select/alignment-intent';
import { solveTargetAlignment } from '../../../modules/positioning/src/geometry/target-alignment';

// Pure opaque identity fixtures, deliberately without DOM properties or methods.
const part = (id: string) => Object.freeze({ id }) as unknown as AnatomyPartView;
const trigger = part('trigger');
const value = part('value');
const records = ['a', 'b', 'c'].map((name) =>
  Object.freeze({ value: name, disabled: false, row: part(name), text: part(`${name}-text`) })
);
const edge: AnchoredPositionConfig = Object.freeze({
  side: 'bottom',
  align: 'center',
  sideOffset: 4,
  alignOffset: 0,
  strategy: 'fixed',
  avoidCollisions: true,
  collisionBoundary: 'viewport',
  collisionPadding: 10,
});
function input(overrides: Partial<InitialSelectAlignmentInput> = {}): InitialSelectAlignmentInput {
  return {
    mode: 'item-aligned',
    edge,
    phase: 'initial-settled',
    committed: { kind: 'value', value: 'b' },
    records,
    reference: { trigger, value },
    ...overrides,
  };
}
function selected(i: InitialSelectAlignmentInput) {
  const result = resolveInitialSelectAlignment(i);
  if (result.kind !== 'target-pair') throw new Error(result.kind);
  return result;
}

describe('initial Select semantic alignment intent (unwired S1)', () => {
  it('selects unique committed enabled value with its own text association', () => {
    const result = selected(input());
    expect(result.reference).toEqual({ inline: value, block: trigger });
    expect(result.floating).toEqual({ inline: records[1].text, block: records[1].row });
    expect(result.contentEdges).toEqual({ atStart: false, atEnd: false });
    expect(result.constraints).toEqual({
      boundary: 'layout-viewport',
      margin: 10,
      minimumTargetSpanCount: 5,
      inlineOverflow: 'preserve-start',
      expandOnScroll: true,
    });
    expect(result).not.toHaveProperty('value');
    expect(result).not.toHaveProperty('selectedIndex');
  });
  it.each([
    { kind: 'unset' as const },
    { kind: 'value' as const, value: 'unknown' },
    { kind: 'value' as const, value: '' },
  ])('uses first enabled on normal initial %j', (committed) => {
    const result = selected(input({ committed }));
    expect(result.floating.block).toBe(records[0].row);
    expect(result.contentEdges).toEqual({ atStart: true, atEnd: false });
  });
  it('skips leading disabled for fallback but does not call first enabled the first record', () => {
    const result = selected(
      input({
        committed: { kind: 'unset' },
        records: [{ ...records[0], disabled: true }, records[1], { ...records[2], disabled: true }],
      })
    );
    expect(result.floating.block).toBe(records[1].row);
    expect(result.contentEdges).toEqual({ atStart: false, atEnd: false });
  });
  it('marks only the actual final collection record as end', () => {
    expect(selected(input({ committed: { kind: 'value', value: 'c' } })).contentEdges).toEqual({
      atStart: false,
      atEnd: true,
    });
  });
  it('explicit popper bypasses all target requirements and preserves config', () => {
    const result = resolveInitialSelectAlignment(
      input({
        mode: 'popper',
        records: [],
        phase: 'unsettled',
        reference: { trigger: null, value: null },
      })
    );
    expect(result).toEqual({ kind: 'edge', config: edge });
    if (result.kind === 'edge') expect(result.config).toBe(edge);
  });
  it('does not substitute another item text when the selected associated text is absent', () => {
    expect(
      resolveInitialSelectAlignment(
        input({ records: [records[0], { ...records[1], text: null }, records[2]] })
      )
    ).toEqual({ kind: 'unresolved', reason: 'missing-text' });
  });
  it('returns missing-row for an unmaterialized selected virtual target', () => {
    expect(
      resolveInitialSelectAlignment(
        input({ records: [records[0], { ...records[1], row: null }, records[2]] })
      )
    ).toEqual({ kind: 'unresolved', reason: 'missing-row' });
  });
  it('keeps disabled selected compatibility unresolved before and after first enabled', () => {
    for (const index of [0, 2]) {
      const disabled = records.map((record, n) => ({ ...record, disabled: n === index }));
      expect(
        resolveInitialSelectAlignment(
          input({ records: disabled, committed: { kind: 'value', value: records[index].value } })
        )
      ).toEqual({ kind: 'unresolved', reason: 'disabled-selected-compatibility' });
    }
  });
  it.each([
    [{ records: [] }, 'empty-collection'],
    [
      {
        records: records.map((record) => ({ ...record, disabled: true })),
        committed: { kind: 'unset' },
      },
      'all-disabled',
    ],
    [{ records: [...records, { ...records[0], row: part('duplicate') }] }, 'duplicate-value'],
    [{ reference: { trigger: null, value } }, 'missing-reference'],
    [{ reference: { trigger, value: null } }, 'missing-reference'],
    [{ phase: 'unsettled' }, 'unsettled'],
    [{ phase: 'open-update' }, 'open-update-compatibility'],
  ] as const)('returns named unresolved for %j', (overrides, reason) => {
    expect(resolveInitialSelectAlignment(input(overrides))).toEqual({ kind: 'unresolved', reason });
  });
  it('reads only committed truth, not an unaccepted controlled proposal', () => {
    const pendingProposal = 'c';
    const committed = 'b';
    const result = selected(input({ committed: { kind: 'value', value: committed } }));
    expect(result.floating.block).toBe(records[1].row);
    expect(result.floating.block).not.toBe(
      records.find((record) => record.value === pendingProposal)?.row
    );
  });
  it('does not generalize normal initial fallback to an already-open unmatched value', () => {
    expect(
      resolveInitialSelectAlignment(
        input({ phase: 'open-update', committed: { kind: 'value', value: 'unknown' } })
      )
    ).toEqual({ kind: 'unresolved', reason: 'open-update-compatibility' });
  });
  it('does not mutate records or freeze caller-owned opaque identities', () => {
    const unfrozenPart = { id: 'unfrozen' } as unknown as AnatomyPartView;
    const i = input({ reference: { trigger: unfrozenPart, value } });
    const snapshot = JSON.stringify(i);
    const result = selected(i);
    expect(JSON.stringify(i)).toBe(snapshot);
    expect(Object.isFrozen(unfrozenPart)).toBe(false);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.reference)).toBe(true);
    expect(Object.isFrozen(result.floating)).toBe(true);
    expect(Object.isFrozen(result.constraints)).toBe(true);
  });
  it('declares constraints consumable by the shared solver without semantic values', () => {
    const intent = selected(input());
    const result = solveTargetAlignment(
      {
        direction: 'ltr',
        viewport: { width: 1000, height: 800 },
        reference: {
          left: 100,
          right: 260,
          top: 300,
          width: 160,
          height: 40,
          valueLeft: 112,
          valueRight: 240,
        },
        surface: {
          left: 0,
          right: 200,
          width: 200,
          clientHeight: 600,
          borderTop: 1,
          borderBottom: 1,
          paddingTop: 0,
          paddingBottom: 0,
        },
        target: { textLeft: 8, textRight: 188, offset: 150, height: 30, ...intent.contentEdges },
        scrollport: {
          scrollHeight: 600,
          offsetTop: 0,
          height: 600,
          paddingTop: 0,
          paddingBottom: 0,
        },
      },
      intent.constraints
    );
    expect(result.kind).toBe('plan');
    if (result.kind === 'plan') expect(result.plan.inline.inset).toBe(104);
  });
});

describe('represented current Select value alignment intent', () => {
  // T-BASE-SELECT-CONTENT-0001-CASE-CURRENT-ALIGNMENT
  it('replaces the row and text together for the new committed enabled value', () => {
    const result = resolveCurrentSelectAlignment(
      input({ phase: 'open-update', committed: { kind: 'value', value: 'c' } })
    );
    expect(result.kind).toBe('target-pair');
    if (result.kind !== 'target-pair') throw new Error(result.kind);
    expect(result.floating).toEqual({ block: records[2].row, inline: records[2].text });
    expect(result.contentEdges).toEqual({ atStart: false, atEnd: true });
  });
  it.each([{ kind: 'unset' as const }, { kind: 'value' as const, value: 'unknown' }])(
    'does not apply initial fallback to current %j',
    (committed) => {
      expect(resolveCurrentSelectAlignment(input({ phase: 'open-update', committed }))).toEqual({
        kind: 'unresolved',
        reason: 'open-update-compatibility',
      });
    }
  );
  it('does not resolve an unsettled update', () => {
    expect(resolveCurrentSelectAlignment(input({ phase: 'unsettled' }))).toEqual({
      kind: 'unresolved',
      reason: 'unsettled',
    });
  });
  it('keeps disabled selected compatibility unresolved', () => {
    expect(
      resolveCurrentSelectAlignment(
        input({ phase: 'open-update', records: [records[0], { ...records[1], disabled: true }] })
      )
    ).toEqual({ kind: 'unresolved', reason: 'disabled-selected-compatibility' });
  });
  it('requires the current registered text association', () => {
    expect(
      resolveCurrentSelectAlignment(
        input({ phase: 'open-update', records: [records[0], { ...records[1], text: null }] })
      )
    ).toEqual({ kind: 'unresolved', reason: 'missing-text' });
  });
  it('keeps duplicate semantic values unresolved', () => {
    expect(
      resolveCurrentSelectAlignment(
        input({ phase: 'open-update', records: [records[1], records[1]] })
      )
    ).toEqual({ kind: 'unresolved', reason: 'duplicate-value' });
  });
  it('leaves explicit popper unchanged even for unrepresented values', () => {
    expect(
      resolveCurrentSelectAlignment(
        input({ mode: 'popper', phase: 'open-update', committed: { kind: 'unset' } })
      )
    ).toEqual({ kind: 'edge', config: edge });
  });
});
