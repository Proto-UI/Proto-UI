import type { ExposeMethod } from '@proto.ui/core';
import type { TableHeaderKind, TableStructureSnapshot } from '@proto.ui/module-table-structure';

export type TableRootProps = Record<string, never>;
export type TableRootExposes = {
  getStructure: ExposeMethod<() => TableStructureSnapshot | null>;
};

export type TableCaptionProps = Record<string, never>;
export type TableCaptionExposes = Record<string, never>;

export type TableRowProps = Record<string, never>;
export type TableRowExposes = Record<string, never>;

export type TableHeaderCellProps = {
  headerKey?: string;
  headerKind?: TableHeaderKind;
  headers?: readonly string[];
  rowSpan?: number;
  columnSpan?: number;
};
export type TableHeaderCellExposes = Record<string, never>;

export type TableCellProps = {
  headers?: readonly string[];
  rowSpan?: number;
  columnSpan?: number;
};
export type TableCellExposes = Record<string, never>;
