import type {
  A11ySemanticObjectRef,
  ModuleInstance,
  ModulePort,
  OwnedStateHandle,
} from '@proto.ui/core';

export type TablePartRole = 'root' | 'caption' | 'row' | 'headerCell' | 'cell';
export type TableHeaderKind = 'column' | 'row';

export type TablePartConfig = Readonly<{
  headerKey?: string;
  headerKind?: TableHeaderKind;
  headers?: readonly string[];
  rowSpan?: number;
  columnSpan?: number;
}>;

export type TableStructureDiagnosticCode =
  | 'multiple-captions'
  | 'missing-row'
  | 'empty-row'
  | 'missing-header-cell'
  | 'missing-cell'
  | 'invalid-span'
  | 'row-span-out-of-range'
  | 'column-range-out-of-range'
  | 'missing-row-parent'
  | 'role-mismatch'
  | 'missing-header-key'
  | 'duplicate-header-key'
  | 'missing-header-kind'
  | 'missing-cell-headers'
  | 'empty-header-reference'
  | 'duplicate-header-reference'
  | 'missing-header-target'
  | 'ambiguous-header-target'
  | 'unprojectable-header-target'
  | 'non-upstream-header-target';

export type TableStructureDiagnostic = Readonly<{
  code: TableStructureDiagnosticCode;
  ref?: A11ySemanticObjectRef;
  row?: number;
  headerKey?: string;
}>;

export type TableStructureCellSnapshot = Readonly<{
  ref: A11ySemanticObjectRef;
  kind: 'column-header' | 'row-header' | 'cell';
  row: number;
  column: number;
  rowSpan: number;
  columnSpan: number;
  columnHeaders: readonly A11ySemanticObjectRef[];
  rowHeaders: readonly A11ySemanticObjectRef[];
  orderedHeaders: readonly A11ySemanticObjectRef[];
}>;

export type TableStructureRowSnapshot = Readonly<{
  ref: A11ySemanticObjectRef;
  index: number;
  cells: readonly TableStructureCellSnapshot[];
}>;

export type TableStructureSnapshot = Readonly<{
  root: A11ySemanticObjectRef;
  caption: A11ySemanticObjectRef | undefined;
  rowCount: number;
  columnCount: number;
  rows: readonly TableStructureRowSnapshot[];
  valid: boolean;
  diagnostics: readonly TableStructureDiagnostic[];
}>;

export type TableStructureStateHandles = Readonly<{
  a11yRole: OwnedStateHandle<string>;
  rowCount: OwnedStateHandle<number>;
  columnCount: OwnedStateHandle<number>;
  row: OwnedStateHandle<number>;
  column: OwnedStateHandle<number>;
  rowSpan: OwnedStateHandle<number>;
  columnSpan: OwnedStateHandle<number>;
}>;

export type TableStructureHandle = Readonly<{
  role: TablePartRole;
  states: TableStructureStateHandles;
  configure(patch: TablePartConfig): void;
  getObjectRef(): A11ySemanticObjectRef;
  getSnapshot(): TableStructureSnapshot | null;
}>;

export type TableStructureFacade = {
  declare(role: TablePartRole): TableStructureHandle;
};

export type TableStructurePort = ModulePort & {
  getSnapshot(): TableStructureSnapshot | null;
};

export type TableStructureModule = ModuleInstance<TableStructureFacade> & {
  name: 'table-structure';
  scope: 'instance';
  port: TableStructurePort;
};
