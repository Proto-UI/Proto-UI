import type { A11ySemanticObjectRef } from '@proto.ui/core';
import type { TableHeaderKind, TableStructureDiagnostic, TableStructureSnapshot } from './types';

export type TableStructureCellInput = Readonly<{
  ref: A11ySemanticObjectRef;
  kind: 'headerCell' | 'cell';
  headerKey?: string;
  headerKind?: TableHeaderKind;
  headers: readonly string[];
  rowSpan?: number;
  columnSpan?: number;
}>;

export type TableStructureRowInput = Readonly<{
  ref: A11ySemanticObjectRef;
  cells: readonly TableStructureCellInput[];
}>;

export type TableStructureInput = Readonly<{
  root: A11ySemanticObjectRef;
  captions: readonly A11ySemanticObjectRef[];
  rows: readonly TableStructureRowInput[];
  unmatchedCells?: readonly A11ySemanticObjectRef[];
  roleMismatches?: readonly A11ySemanticObjectRef[];
}>;

type Dimensions = Readonly<{ rowSpan: number; columnSpan: number }>;
type Interval = { start: number; end: number };
type MutableCell = {
  ref: A11ySemanticObjectRef;
  kind: 'column-header' | 'row-header' | 'cell';
  row: number;
  column: number;
  rowSpan: number;
  columnSpan: number;
  columnHeaders: A11ySemanticObjectRef[];
  rowHeaders: A11ySemanticObjectRef[];
  orderedHeaders: A11ySemanticObjectRef[];
};

export function projectTableStructure(input: TableStructureInput): TableStructureSnapshot {
  const diagnostics: TableStructureDiagnostic[] = [];
  if (input.captions.length > 1) diagnostics.push({ code: 'multiple-captions' });
  if (input.rows.length === 0) diagnostics.push({ code: 'missing-row' });
  for (const ref of input.unmatchedCells ?? []) {
    diagnostics.push({ code: 'missing-row-parent', ref });
  }
  for (const ref of input.roleMismatches ?? []) {
    diagnostics.push({ code: 'role-mismatch', ref });
  }

  let headerCellCount = 0;
  let cellCount = 0;
  for (let row = 0; row < input.rows.length; row++) {
    const rowInput = input.rows[row]!;
    if (rowInput.cells.length === 0)
      diagnostics.push({ code: 'empty-row', ref: rowInput.ref, row });
    for (const cell of rowInput.cells) {
      if (cell.kind === 'headerCell') {
        headerCellCount++;
        if (!cell.headerKey) diagnostics.push({ code: 'missing-header-key', ref: cell.ref, row });
        if (cell.headerKind !== 'column' && cell.headerKind !== 'row') {
          diagnostics.push({ code: 'missing-header-kind', ref: cell.ref, row });
        }
      } else cellCount++;
    }
  }
  if (headerCellCount === 0) diagnostics.push({ code: 'missing-header-cell' });
  if (cellCount === 0) diagnostics.push({ code: 'missing-cell' });

  const dimensions = new Map<TableStructureCellInput, Dimensions | null>();
  for (const row of input.rows) {
    for (const cell of row.cells) {
      const rowSpan = cell.rowSpan ?? 1;
      const columnSpan = cell.columnSpan ?? 1;
      if (
        !Number.isSafeInteger(rowSpan) ||
        rowSpan <= 0 ||
        !Number.isSafeInteger(columnSpan) ||
        columnSpan <= 0
      ) {
        diagnostics.push({ code: 'invalid-span', ref: cell.ref });
        dimensions.set(cell, null);
      } else dimensions.set(cell, { rowSpan, columnSpan });
    }
  }

  const occupied = new Map<number, Interval[]>();
  const placed = new Map<TableStructureCellInput, MutableCell>();
  const rows: { ref: A11ySemanticObjectRef; index: number; cells: MutableCell[] }[] = [];
  let columnCount = 0;
  for (let row = 0; row < input.rows.length; row++) {
    const rowInput = input.rows[row]!;
    const cells: MutableCell[] = [];
    let cursor = 0;
    for (const inputCell of rowInput.cells) {
      const size = dimensions.get(inputCell);
      if (!size) continue;
      if (row + size.rowSpan > input.rows.length) {
        diagnostics.push({ code: 'row-span-out-of-range', ref: inputCell.ref, row });
        continue;
      }
      const column = firstAvailableColumn(occupied, row, cursor, size.rowSpan, size.columnSpan);
      if (column === null) {
        diagnostics.push({ code: 'column-range-out-of-range', ref: inputCell.ref, row });
        continue;
      }
      occupy(occupied, row, column, size.rowSpan, size.columnSpan);
      cursor = column + size.columnSpan;
      columnCount = Math.max(columnCount, cursor);
      const cell: MutableCell = {
        ref: inputCell.ref,
        kind:
          inputCell.kind === 'cell'
            ? 'cell'
            : inputCell.headerKind === 'row'
              ? 'row-header'
              : 'column-header',
        row,
        column,
        rowSpan: size.rowSpan,
        columnSpan: size.columnSpan,
        columnHeaders: [],
        rowHeaders: [],
        orderedHeaders: [],
      };
      cells.push(cell);
      placed.set(inputCell, cell);
    }
    rows.push({ ref: rowInput.ref, index: row, cells });
  }

  const headersByKey = new Map<string, TableStructureCellInput[]>();
  for (const row of input.rows) {
    for (const cell of row.cells) {
      if (cell.kind !== 'headerCell' || !cell.headerKey) continue;
      const matches = headersByKey.get(cell.headerKey);
      if (matches) matches.push(cell);
      else headersByKey.set(cell.headerKey, [cell]);
    }
  }
  for (const [headerKey, matches] of headersByKey) {
    if (matches.length > 1)
      diagnostics.push({ code: 'duplicate-header-key', ref: matches[0]!.ref, headerKey });
  }

  for (let row = 0; row < input.rows.length; row++) {
    for (const inputCell of input.rows[row]!.cells) {
      if (inputCell.kind === 'cell' && inputCell.headers.length === 0) {
        diagnostics.push({ code: 'missing-cell-headers', ref: inputCell.ref, row });
      }
      const source = placed.get(inputCell);
      const seen = new Set<string>();
      for (const headerKey of inputCell.headers) {
        if (!headerKey) {
          diagnostics.push({ code: 'empty-header-reference', ref: inputCell.ref, row });
          continue;
        }
        if (seen.has(headerKey)) {
          diagnostics.push({
            code: 'duplicate-header-reference',
            ref: inputCell.ref,
            row,
            headerKey,
          });
          continue;
        }
        seen.add(headerKey);
        const matches = headersByKey.get(headerKey);
        if (!matches) {
          diagnostics.push({ code: 'missing-header-target', ref: inputCell.ref, row, headerKey });
          continue;
        }
        if (matches.length !== 1) {
          diagnostics.push({ code: 'ambiguous-header-target', ref: inputCell.ref, row, headerKey });
          continue;
        }
        const targetInput = matches[0]!;
        const target = placed.get(targetInput);
        if (!target) {
          diagnostics.push({
            code: 'unprojectable-header-target',
            ref: inputCell.ref,
            row,
            headerKey,
          });
          continue;
        }
        if (
          inputCell.kind === 'headerCell' &&
          source &&
          (target.row > source.row || (target.row === source.row && target.column >= source.column))
        ) {
          diagnostics.push({
            code: 'non-upstream-header-target',
            ref: inputCell.ref,
            row,
            headerKey,
          });
          continue;
        }
        if (!source) continue;
        source.orderedHeaders.push(targetInput.ref);
        if (targetInput.headerKind === 'row') source.rowHeaders.push(targetInput.ref);
        else source.columnHeaders.push(targetInput.ref);
      }
    }
  }

  return freezeSnapshot({
    root: input.root,
    caption: input.captions.length === 1 ? input.captions[0] : undefined,
    rowCount: input.rows.length,
    columnCount,
    rows,
    valid: diagnostics.length === 0,
    diagnostics,
  });
}

function firstAvailableColumn(
  occupied: ReadonlyMap<number, readonly Interval[]>,
  row: number,
  start: number,
  rowSpan: number,
  columnSpan: number
): number | null {
  let column = start;
  for (;;) {
    const end = column + columnSpan;
    if (!Number.isSafeInteger(end)) return null;
    let next = column;
    for (let offset = 0; offset < rowSpan; offset++) {
      for (const interval of occupied.get(row + offset) ?? []) {
        if (interval.end <= column) continue;
        if (interval.start >= end) break;
        next = Math.max(next, interval.end);
        break;
      }
    }
    if (next === column) return column;
    column = next;
  }
}

function occupy(
  occupied: Map<number, Interval[]>,
  row: number,
  column: number,
  rowSpan: number,
  columnSpan: number
): void {
  const end = column + columnSpan;
  for (let offset = 0; offset < rowSpan; offset++) {
    const rowIndex = row + offset;
    const intervals = occupied.get(rowIndex) ?? [];
    let at = 0;
    while (at < intervals.length && intervals[at]!.end < column) at++;
    let start = column;
    let mergedEnd = end;
    while (at < intervals.length && intervals[at]!.start <= mergedEnd) {
      const current = intervals[at]!;
      start = Math.min(start, current.start);
      mergedEnd = Math.max(mergedEnd, current.end);
      intervals.splice(at, 1);
    }
    intervals.splice(at, 0, { start, end: mergedEnd });
    occupied.set(rowIndex, intervals);
  }
}

function freezeSnapshot(snapshot: {
  root: A11ySemanticObjectRef;
  caption: A11ySemanticObjectRef | undefined;
  rowCount: number;
  columnCount: number;
  rows: { ref: A11ySemanticObjectRef; index: number; cells: MutableCell[] }[];
  valid: boolean;
  diagnostics: TableStructureDiagnostic[];
}): TableStructureSnapshot {
  return Object.freeze({
    ...snapshot,
    rows: Object.freeze(
      snapshot.rows.map((row) =>
        Object.freeze({
          ...row,
          cells: Object.freeze(
            row.cells.map((cell) =>
              Object.freeze({
                ...cell,
                columnHeaders: Object.freeze([...cell.columnHeaders]),
                rowHeaders: Object.freeze([...cell.rowHeaders]),
                orderedHeaders: Object.freeze([...cell.orderedHeaders]),
              })
            )
          ),
        })
      )
    ),
    diagnostics: Object.freeze(
      snapshot.diagnostics.map((diagnostic) => Object.freeze({ ...diagnostic }))
    ),
  });
}
