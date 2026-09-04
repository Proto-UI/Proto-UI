import { describe, expect, it } from 'vitest';

import { projectTableStructure } from '../src/table-structure/reference';

function ref(name: string) {
  return Object.freeze({ semanticPart: name });
}

describe('spec fixture: Table Structure reference projection', () => {
  it('places ordered cells and resolves multiple headers to opaque semantic references', () => {
    // T-TABLE-STRUCTURE-0001-CASE-TOPOLOGY
    // T-TABLE-STRUCTURE-0001-CASE-HEADER-GRAPH
    const root = ref('table');
    const caption = ref('caption');
    const quarterGroup = ref('quarter-group');
    const firstQuarter = ref('first-quarter');
    const secondQuarter = ref('second-quarter');
    const alice = ref('alice');
    const aliceQ1 = ref('alice-q1');
    const aliceQ2 = ref('alice-q2');

    const snapshot = projectTableStructure({
      root,
      captions: [caption],
      rows: [
        {
          ref: ref('group-row'),
          cells: [
            {
              ref: quarterGroup,
              kind: 'headerCell',
              headerKey: 'quarter-group',
              headerKind: 'column',
              columnSpan: 2,
            },
          ],
        },
        {
          ref: ref('column-row'),
          cells: [
            {
              ref: firstQuarter,
              kind: 'headerCell',
              headerKey: 'q1',
              headerKind: 'column',
              headers: ['quarter-group'],
            },
            {
              ref: secondQuarter,
              kind: 'headerCell',
              headerKey: 'q2',
              headerKind: 'column',
              headers: ['quarter-group'],
            },
          ],
        },
        {
          ref: ref('alice-row'),
          cells: [
            {
              ref: alice,
              kind: 'headerCell',
              headerKey: 'alice',
              headerKind: 'row',
            },
            { ref: aliceQ1, kind: 'cell', headers: ['quarter-group', 'q1', 'alice'] },
            { ref: aliceQ2, kind: 'cell', headers: ['quarter-group', 'q2', 'alice'] },
          ],
        },
      ],
    });

    expect(snapshot.valid).toBe(true);
    expect(snapshot.diagnostics).toEqual([]);
    expect(snapshot.root).toBe(root);
    expect(snapshot.caption).toBe(caption);
    expect(snapshot.rowCount).toBe(3);
    expect(snapshot.columnCount).toBe(3);
    expect(snapshot.rows[0]?.cells[0]).toMatchObject({
      ref: quarterGroup,
      kind: 'column-header',
      row: 0,
      column: 0,
      rowSpan: 1,
      columnSpan: 2,
    });
    expect(snapshot.rows[2]?.cells[1]).toMatchObject({
      ref: aliceQ1,
      kind: 'cell',
      row: 2,
      column: 1,
      rowSpan: 1,
      columnSpan: 1,
      columnHeaders: [quarterGroup, firstQuarter],
      rowHeaders: [alice],
    });
    expect(snapshot.rows[2]?.cells[2]).toMatchObject({
      ref: aliceQ2,
      column: 2,
      columnHeaders: [quarterGroup, secondQuarter],
      rowHeaders: [alice],
    });
    expect(snapshot.rows[1]?.cells[0]?.columnHeaders).toEqual([quarterGroup]);
    expect(snapshot.rows[1]?.cells[0]?.rowHeaders).toEqual([]);
    expect(snapshot.rows[2]?.cells[1]?.columnHeaders).not.toContain('q1');
  });

  it('uses first-unoccupied rectangular placement for row spans', () => {
    // T-TABLE-STRUCTURE-0001-CASE-TOPOLOGY
    const spanningHeader = ref('spanning-row-header');
    const nextHeader = ref('next-row-header');

    const snapshot = projectTableStructure({
      root: ref('table'),
      rows: [
        {
          ref: ref('row-0'),
          cells: [
            {
              ref: spanningHeader,
              kind: 'headerCell',
              headerKey: 'row-group',
              headerKind: 'row',
              rowSpan: 2,
            },
            {
              ref: ref('column-header'),
              kind: 'headerCell',
              headerKey: 'value',
              headerKind: 'column',
            },
          ],
        },
        {
          ref: ref('row-1'),
          cells: [
            {
              ref: nextHeader,
              kind: 'headerCell',
              headerKey: 'next',
              headerKind: 'row',
            },
            { ref: ref('value'), kind: 'cell', headers: ['row-group', 'value'] },
          ],
        },
      ],
    });

    expect(snapshot.valid).toBe(true);
    expect(snapshot.rows[1]?.cells[0]).toMatchObject({ ref: nextHeader, row: 1, column: 1 });
    expect(snapshot.rows[1]?.cells[1]).toMatchObject({ row: 1, column: 2 });
    expect(snapshot.columnCount).toBe(3);
  });

  it('reports invalid spans and ambiguous or missing header relationships without guessing', () => {
    // T-TABLE-STRUCTURE-0001-CASE-DIAGNOSTICS
    const duplicateA = ref('duplicate-a');
    const duplicateB = ref('duplicate-b');
    const dataCell = ref('data');

    const snapshot = projectTableStructure({
      root: ref('table'),
      captions: [ref('caption-a'), ref('caption-b')],
      rows: [
        {
          ref: ref('row-0'),
          cells: [
            {
              ref: duplicateA,
              kind: 'headerCell',
              headerKey: 'duplicate',
              headerKind: 'column',
            },
            {
              ref: duplicateB,
              kind: 'headerCell',
              headerKey: 'duplicate',
              headerKind: 'row',
            },
            {
              ref: ref('out-of-range'),
              kind: 'headerCell',
              headerKey: 'out-of-range',
              headerKind: 'column',
              rowSpan: 3,
            },
            {
              ref: ref('missing-key-invalid-span'),
              kind: 'headerCell',
              headerKey: '',
              headerKind: 'column',
              columnSpan: 0,
            },
            { ref: dataCell, kind: 'cell', headers: ['duplicate', 'missing', 'missing'] },
            { ref: ref('invalid-span'), kind: 'cell', headers: ['duplicate'], columnSpan: 0 },
          ],
        },
        { ref: ref('empty-row'), cells: [] },
      ],
    });

    expect(snapshot.valid).toBe(false);
    expect(snapshot.caption).toBeUndefined();
    expect(snapshot.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'multiple-captions',
      'missing-header-key',
      'empty-row',
      'invalid-span',
      'invalid-span',
      'row-span-out-of-range',
      'duplicate-header-key',
      'ambiguous-header-target',
      'missing-header-target',
      'duplicate-header-reference',
      'ambiguous-header-target',
    ]);
    const projectedData = snapshot.rows[0]?.cells.find((cell) => cell.ref === dataCell);
    expect(projectedData?.columnHeaders).toEqual([]);
    expect(projectedData?.rowHeaders).toEqual([]);
  });

  it('keeps invalid HeaderCells in same-domain header-key uniqueness checks', () => {
    // T-TABLE-STRUCTURE-0001-CASE-DIAGNOSTICS
    const validHeader = ref('valid-header');
    const invalidHeader = ref('invalid-header');
    const dataCell = ref('data-cell');

    const snapshot = projectTableStructure({
      root: ref('table'),
      rows: [
        {
          ref: ref('row'),
          cells: [
            {
              ref: validHeader,
              kind: 'headerCell',
              headerKey: 'shared',
              headerKind: 'column',
            },
            {
              ref: invalidHeader,
              kind: 'headerCell',
              headerKey: 'shared',
              headerKind: 'column',
              columnSpan: 0,
            },
            { ref: dataCell, kind: 'cell', headers: ['shared'] },
          ],
        },
      ],
    });

    expect(snapshot.valid).toBe(false);
    expect(snapshot.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'invalid-span',
      'duplicate-header-key',
      'ambiguous-header-target',
    ]);
    const projectedData = snapshot.rows[0]?.cells.find((cell) => cell.ref === dataCell);
    expect(projectedData?.columnHeaders).toEqual([]);
  });

  it('recomputes structural churn without mutating authored inputs or adding data-operation state', () => {
    // T-TABLE-STRUCTURE-0001-CASE-STRUCTURAL-CHURN
    // T-TABLE-STRUCTURE-0001-CASE-INDEPENDENT-PROTOCOL
    const header = ref('header');
    const firstCell = ref('first');
    const secondCell = ref('second');
    const headerRow = Object.freeze({
      ref: ref('header-row'),
      cells: Object.freeze([
        Object.freeze({
          ref: header,
          kind: 'headerCell' as const,
          headerKey: 'value',
          headerKind: 'column' as const,
        }),
      ]),
    });
    const firstRow = Object.freeze({
      ref: ref('first-row'),
      cells: Object.freeze([
        Object.freeze({ ref: firstCell, kind: 'cell' as const, headers: ['value'] as const }),
      ]),
    });
    const secondRow = Object.freeze({
      ref: ref('second-row'),
      cells: Object.freeze([
        Object.freeze({ ref: secondCell, kind: 'cell' as const, headers: ['value'] as const }),
      ]),
    });
    const insertedCell = ref('inserted');
    const insertedRow = Object.freeze({
      ref: ref('inserted-row'),
      cells: Object.freeze([
        Object.freeze({ ref: insertedCell, kind: 'cell' as const, headers: ['value'] as const }),
      ]),
    });

    const before = projectTableStructure({
      root: ref('table'),
      rows: [headerRow, firstRow, secondRow],
    });
    const after = projectTableStructure({
      root: before.root,
      rows: [headerRow, secondRow],
    });
    const inserted = projectTableStructure({
      root: before.root,
      rows: [headerRow, firstRow, insertedRow, secondRow],
    });
    const reordered = projectTableStructure({
      root: before.root,
      rows: [headerRow, secondRow, firstRow],
    });

    expect(before.rows[2]?.cells[0]?.row).toBe(2);
    expect(after.rows[1]?.cells[0]).toMatchObject({ ref: secondCell, row: 1, column: 0 });
    expect(after.rows[1]?.cells[0]?.columnHeaders).toEqual([header]);
    expect(inserted.rows[2]?.cells[0]).toMatchObject({ ref: insertedCell, row: 2, column: 0 });
    expect(inserted.rows[3]?.cells[0]).toMatchObject({ ref: secondCell, row: 3, column: 0 });
    expect(reordered.rows[1]?.cells[0]).toMatchObject({ ref: secondCell, row: 1, column: 0 });
    expect(reordered.rows[2]?.cells[0]).toMatchObject({ ref: firstCell, row: 2, column: 0 });
    expect(reordered.rows[1]?.cells[0]?.columnHeaders).toEqual([header]);
    expect(firstRow.cells[0]?.headers).toEqual(['value']);
    expect(Object.keys(after).sort()).toEqual([
      'caption',
      'columnCount',
      'diagnostics',
      'root',
      'rowCount',
      'rows',
      'valid',
    ]);
  });
});
