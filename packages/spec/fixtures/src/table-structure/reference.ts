export type TableHeaderKind = 'column' | 'row';

export type TableStructureCellInput<Ref> =
  | {
      readonly ref: Ref;
      readonly kind: 'headerCell';
      readonly headerKey: string;
      readonly headerKind: TableHeaderKind;
      readonly headers?: readonly string[];
      readonly rowSpan?: number;
      readonly columnSpan?: number;
    }
  | {
      readonly ref: Ref;
      readonly kind: 'cell';
      readonly headers: readonly string[];
      readonly rowSpan?: number;
      readonly columnSpan?: number;
    };

export type TableStructureRowInput<Ref> = {
  readonly ref: Ref;
  readonly cells: readonly TableStructureCellInput<Ref>[];
};

export type TableStructureInput<Ref> = {
  readonly root: Ref;
  readonly captions?: readonly Ref[];
  readonly rows: readonly TableStructureRowInput<Ref>[];
};

export type TableStructureDiagnosticCode =
  | 'multiple-captions'
  | 'missing-row'
  | 'empty-row'
  | 'missing-header-cell'
  | 'missing-cell'
  | 'invalid-span'
  | 'row-span-out-of-range'
  | 'column-range-out-of-range'
  | 'missing-header-key'
  | 'duplicate-header-key'
  | 'missing-cell-headers'
  | 'empty-header-reference'
  | 'duplicate-header-reference'
  | 'missing-header-target'
  | 'ambiguous-header-target'
  | 'unprojectable-header-target'
  | 'non-upstream-header-target';

export type TableStructureDiagnostic<Ref> = {
  readonly code: TableStructureDiagnosticCode;
  readonly ref?: Ref;
  readonly row?: number;
  readonly headerKey?: string;
};

export type TableStructureCellSnapshot<Ref> = {
  readonly ref: Ref;
  readonly kind: 'column-header' | 'row-header' | 'cell';
  readonly row: number;
  readonly column: number;
  readonly rowSpan: number;
  readonly columnSpan: number;
  readonly columnHeaders: readonly Ref[];
  readonly rowHeaders: readonly Ref[];
};

export type TableStructureRowSnapshot<Ref> = {
  readonly ref: Ref;
  readonly index: number;
  readonly cells: readonly TableStructureCellSnapshot<Ref>[];
};

export type TableStructureSnapshot<Ref> = {
  readonly root: Ref;
  readonly caption: Ref | undefined;
  readonly rowCount: number;
  readonly columnCount: number;
  readonly rows: readonly TableStructureRowSnapshot<Ref>[];
  readonly valid: boolean;
  readonly diagnostics: readonly TableStructureDiagnostic<Ref>[];
};

type CellDimensions = {
  readonly rowSpan: number;
  readonly columnSpan: number;
};

type ColumnInterval = {
  readonly start: number;
  readonly end: number;
};

type PlacedCell<Ref> = {
  readonly input: TableStructureCellInput<Ref>;
  readonly snapshot: TableStructureCellSnapshot<Ref>;
};

/**
 * Executable host-neutral probe for C-TABLE-STRUCTURE-0001.
 *
 * This fixture deliberately accepts opaque references and has no runtime, Template, A11y, or
 * Adapter dependency. It proves the deterministic topology and header-resolution rules only; it
 * is not Base Table or host conformance.
 */
export function projectTableStructure<Ref>(
  input: TableStructureInput<Ref>
): TableStructureSnapshot<Ref> {
  const diagnostics: TableStructureDiagnostic<Ref>[] = [];
  const captions = input.captions ?? [];

  if (captions.length > 1) diagnostics.push({ code: 'multiple-captions' });
  if (input.rows.length === 0) diagnostics.push({ code: 'missing-row' });

  let headerCellCount = 0;
  let cellCount = 0;
  for (let row = 0; row < input.rows.length; row += 1) {
    const rowInput = input.rows[row]!;
    if (rowInput.cells.length === 0)
      diagnostics.push({ code: 'empty-row', ref: rowInput.ref, row });
    for (const cell of rowInput.cells) {
      if (cell.kind === 'headerCell') {
        headerCellCount += 1;
        if (cell.headerKey.length === 0) {
          diagnostics.push({ code: 'missing-header-key', ref: cell.ref, row });
        }
      } else {
        cellCount += 1;
      }
    }
  }
  if (headerCellCount === 0) diagnostics.push({ code: 'missing-header-cell' });
  if (cellCount === 0) diagnostics.push({ code: 'missing-cell' });

  const dimensions = new Map<TableStructureCellInput<Ref>, CellDimensions | null>();
  for (const rowInput of input.rows) {
    for (const cell of rowInput.cells) {
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
      } else {
        dimensions.set(cell, { rowSpan, columnSpan });
      }
    }
  }

  const occupied = new Map<number, ColumnInterval[]>();
  const placed: PlacedCell<Ref>[] = [];
  const rows: TableStructureRowSnapshot<Ref>[] = [];
  let columnCount = 0;

  for (let row = 0; row < input.rows.length; row += 1) {
    const rowInput = input.rows[row]!;
    const cells: TableStructureCellSnapshot<Ref>[] = [];
    let columnCursor = 0;

    for (const cell of rowInput.cells) {
      const size = dimensions.get(cell);
      if (!size) continue;
      if (row + size.rowSpan > input.rows.length) {
        diagnostics.push({ code: 'row-span-out-of-range', ref: cell.ref, row });
        continue;
      }

      const column = firstAvailableColumn(
        occupied,
        row,
        columnCursor,
        size.rowSpan,
        size.columnSpan
      );
      if (column === null) {
        diagnostics.push({ code: 'column-range-out-of-range', ref: cell.ref, row });
        continue;
      }
      occupy(occupied, row, column, size.rowSpan, size.columnSpan);
      columnCursor = column + size.columnSpan;
      columnCount = Math.max(columnCount, columnCursor);

      const snapshot: TableStructureCellSnapshot<Ref> = {
        ref: cell.ref,
        kind:
          cell.kind === 'cell'
            ? 'cell'
            : cell.headerKind === 'column'
              ? 'column-header'
              : 'row-header',
        row,
        column,
        rowSpan: size.rowSpan,
        columnSpan: size.columnSpan,
        columnHeaders: [],
        rowHeaders: [],
      };
      cells.push(snapshot);
      placed.push({ input: cell, snapshot });
    }

    rows.push({ ref: rowInput.ref, index: row, cells });
  }

  const placedByInput = new Map(placed.map((entry) => [entry.input, entry]));
  const headersByKey = new Map<
    string,
    Extract<TableStructureCellInput<Ref>, { kind: 'headerCell' }>[]
  >();
  for (const row of input.rows) {
    for (const cell of row.cells) {
      if (cell.kind !== 'headerCell' || cell.headerKey.length === 0) continue;
      const matches = headersByKey.get(cell.headerKey);
      if (matches) matches.push(cell);
      else headersByKey.set(cell.headerKey, [cell]);
    }
  }
  for (const [headerKey, matches] of headersByKey) {
    if (matches.length > 1) {
      diagnostics.push({
        code: 'duplicate-header-key',
        ref: matches[0]!.ref,
        headerKey,
      });
    }
  }

  for (let row = 0; row < input.rows.length; row += 1) {
    for (const cell of input.rows[row]!.cells) {
      const headerKeys = cell.headers ?? [];
      if (cell.kind === 'cell' && headerKeys.length === 0) {
        diagnostics.push({ code: 'missing-cell-headers', ref: cell.ref, row });
      }

      const source = placedByInput.get(cell)?.snapshot;
      const columnHeaders: Ref[] = [];
      const rowHeaders: Ref[] = [];
      const seen = new Set<string>();
      for (const authoredKey of headerKeys) {
        const headerKey = authoredKey;
        if (headerKey.length === 0) {
          diagnostics.push({ code: 'empty-header-reference', ref: cell.ref, row });
          continue;
        }
        if (seen.has(headerKey)) {
          diagnostics.push({
            code: 'duplicate-header-reference',
            ref: cell.ref,
            row,
            headerKey,
          });
          continue;
        }
        seen.add(headerKey);

        const matches = headersByKey.get(headerKey);
        if (!matches) {
          diagnostics.push({ code: 'missing-header-target', ref: cell.ref, row, headerKey });
          continue;
        }
        if (matches.length !== 1) {
          diagnostics.push({ code: 'ambiguous-header-target', ref: cell.ref, row, headerKey });
          continue;
        }

        const targetInput = matches[0]!;
        const target = placedByInput.get(targetInput);
        if (!target) {
          diagnostics.push({ code: 'unprojectable-header-target', ref: cell.ref, row, headerKey });
          continue;
        }
        if (
          cell.kind === 'headerCell' &&
          source &&
          (target.snapshot.row > source.row ||
            (target.snapshot.row === source.row && target.snapshot.column >= source.column))
        ) {
          diagnostics.push({ code: 'non-upstream-header-target', ref: cell.ref, row, headerKey });
          continue;
        }
        if (targetInput.headerKind === 'column') columnHeaders.push(targetInput.ref);
        else rowHeaders.push(targetInput.ref);
      }

      if (!source) continue;
      (source.columnHeaders as Ref[]).push(...columnHeaders);
      (source.rowHeaders as Ref[]).push(...rowHeaders);
    }
  }

  return {
    root: input.root,
    caption: captions.length === 1 ? captions[0] : undefined,
    rowCount: input.rows.length,
    columnCount,
    rows,
    valid: diagnostics.length === 0,
    diagnostics,
  };
}

function firstAvailableColumn(
  occupied: ReadonlyMap<number, readonly ColumnInterval[]>,
  row: number,
  start: number,
  rowSpan: number,
  columnSpan: number
): number | null {
  let column = start;
  for (;;) {
    const end = column + columnSpan;
    if (!Number.isSafeInteger(end)) return null;

    let nextColumn = column;
    for (let rowOffset = 0; rowOffset < rowSpan; rowOffset += 1) {
      const intervals = occupied.get(row + rowOffset);
      if (!intervals) continue;
      for (const interval of intervals) {
        if (interval.end <= column) continue;
        if (interval.start >= end) break;
        nextColumn = Math.max(nextColumn, interval.end);
        break;
      }
    }
    if (nextColumn === column) return column;
    column = nextColumn;
  }
}

function occupy(
  occupied: Map<number, ColumnInterval[]>,
  row: number,
  column: number,
  rowSpan: number,
  columnSpan: number
): void {
  const end = column + columnSpan;
  for (let rowOffset = 0; rowOffset < rowSpan; rowOffset += 1) {
    const rowIndex = row + rowOffset;
    const intervals = occupied.get(rowIndex);
    if (!intervals) {
      occupied.set(rowIndex, [{ start: column, end }]);
      continue;
    }

    let insertion = 0;
    while (insertion < intervals.length && intervals[insertion]!.end < column) insertion += 1;
    let mergedStart = column;
    let mergedEnd = end;
    while (insertion < intervals.length && intervals[insertion]!.start <= mergedEnd) {
      const current = intervals[insertion]!;
      mergedStart = Math.min(mergedStart, current.start);
      mergedEnd = Math.max(mergedEnd, current.end);
      intervals.splice(insertion, 1);
    }
    intervals.splice(insertion, 0, { start: mergedStart, end: mergedEnd });
  }
}
