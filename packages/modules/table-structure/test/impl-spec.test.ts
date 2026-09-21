import { describe, expect, it } from 'vitest';
import { createA11ySemanticObjectRef } from '@proto.ui/core';
import { projectTableStructure } from '../src/projection';

const ref = () => createA11ySemanticObjectRef();

describe('M-TABLE-STRUCTURE-0001', () => {
  it('projects monotonic range-based topology and ordered opaque headers', () => {
    const group = ref();
    const column = ref();
    const rowHeader = ref();
    const value = ref();
    const snapshot = projectTableStructure({
      root: ref(),
      captions: [ref()],
      rows: [
        {
          ref: ref(),
          cells: [
            {
              ref: group,
              kind: 'headerCell',
              headerKey: 'group',
              headerKind: 'column',
              headers: [],
              columnSpan: 2,
            },
          ],
        },
        {
          ref: ref(),
          cells: [
            {
              ref: column,
              kind: 'headerCell',
              headerKey: 'column',
              headerKind: 'column',
              headers: ['group'],
            },
          ],
        },
        {
          ref: ref(),
          cells: [
            {
              ref: rowHeader,
              kind: 'headerCell',
              headerKey: 'row',
              headerKind: 'row',
              headers: [],
            },
            { ref: value, kind: 'cell', headers: ['group', 'column', 'row'] },
          ],
        },
      ],
    });
    expect(snapshot).toMatchObject({ valid: true, rowCount: 3, columnCount: 2 });
    expect(snapshot.rows[2].cells[1]).toMatchObject({ row: 2, column: 1 });
    expect(snapshot.rows[2].cells[1].columnHeaders).toEqual([group, column]);
    expect(snapshot.rows[2].cells[1].rowHeaders).toEqual([rowHeader]);
    expect(snapshot.rows[2].cells[1].columnHeaders).not.toContain('column');
  });

  it('never expands a large safe span into per-coordinate storage', () => {
    const header = ref();
    const snapshot = projectTableStructure({
      root: ref(),
      captions: [],
      rows: [
        {
          ref: ref(),
          cells: [
            {
              ref: header,
              kind: 'headerCell',
              headerKey: 'large',
              headerKind: 'column',
              headers: [],
              columnSpan: 1_000_000_000,
            },
            { ref: ref(), kind: 'cell', headers: ['large'] },
          ],
        },
      ],
    });
    expect(snapshot.valid).toBe(true);
    expect(snapshot.columnCount).toBe(1_000_000_001);
    expect(snapshot.rows[0].cells[1].column).toBe(1_000_000_000);
  });

  it('fails closed for unsafe structure and reference ambiguity', () => {
    const duplicate = 'same';
    const snapshot = projectTableStructure({
      root: ref(),
      captions: [ref(), ref()],
      rows: [
        {
          ref: ref(),
          cells: [
            {
              ref: ref(),
              kind: 'headerCell',
              headerKey: duplicate,
              headerKind: 'column',
              headers: [],
              rowSpan: 3,
            },
            {
              ref: ref(),
              kind: 'headerCell',
              headerKey: duplicate,
              headerKind: 'row',
              headers: [],
            },
            { ref: ref(), kind: 'cell', headers: [duplicate, duplicate, ''] },
          ],
        },
      ],
    });
    expect(snapshot.valid).toBe(false);
    expect(snapshot.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        'multiple-captions',
        'row-span-out-of-range',
        'duplicate-header-key',
        'ambiguous-header-target',
        'duplicate-header-reference',
        'empty-header-reference',
      ])
    );
  });

  it('rejects self and downstream HeaderCell edges', () => {
    const first = ref();
    const second = ref();
    const snapshot = projectTableStructure({
      root: ref(),
      captions: [],
      rows: [
        {
          ref: ref(),
          cells: [
            {
              ref: first,
              kind: 'headerCell',
              headerKey: 'first',
              headerKind: 'column',
              headers: ['second'],
            },
            {
              ref: second,
              kind: 'headerCell',
              headerKey: 'second',
              headerKind: 'column',
              headers: ['second'],
            },
            { ref: ref(), kind: 'cell', headers: ['first'] },
          ],
        },
      ],
    });
    expect(
      snapshot.diagnostics.filter((item) => item.code === 'non-upstream-header-target')
    ).toHaveLength(2);
  });
});
