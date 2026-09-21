import type { ExposeMethod, ExposeValue } from '@proto.ui/core';
import type {
  TableHeaderKind,
  TableStructurePartBridge,
  TableStructureSnapshot,
} from '@proto.ui/module-table-structure';

export type TableRootProps = Record<string, never>;
export type TableRootExposes = {
  getStructure: ExposeMethod<() => TableStructureSnapshot | null>;
  __tableStructurePart: ExposeValue<TableStructurePartBridge>;
};

export type TableCaptionProps = Record<string, never>;
export type TableCaptionExposes = {
  __tableStructurePart: ExposeValue<TableStructurePartBridge>;
};

export type TableRowProps = Record<string, never>;
export type TableRowExposes = {
  __tableStructurePart: ExposeValue<TableStructurePartBridge>;
};

export type TableHeaderCellProps = {
  headerKey?: string;
  headerKind?: TableHeaderKind;
  headers?: readonly string[];
  rowSpan?: number;
  columnSpan?: number;
};
export type TableHeaderCellExposes = {
  __tableStructurePart: ExposeValue<TableStructurePartBridge>;
};

export type TableCellProps = {
  headers?: readonly string[];
  rowSpan?: number;
  columnSpan?: number;
};
export type TableCellExposes = {
  __tableStructurePart: ExposeValue<TableStructurePartBridge>;
};
