import { defineAsHook, definePrototype } from '@proto.ui/core';
import { tableRow, type TableRowProps, type TableRowExposes } from '../table';

/** A static Table Row-derived composition, not a selectable data-row slot. */
export type DataTableHeaderRowProps = TableRowProps;
export type DataTableHeaderRowExposes = TableRowExposes;
export type DataTableHeaderRowAsHookContract = {};

// The public helper owns setup, once-policy, trace and capture. Do not call
// tableRow.setup directly or condition this identity on the runtime header prop.
export const asDataTableHeaderRow = defineAsHook<
  DataTableHeaderRowProps,
  DataTableHeaderRowExposes,
  DataTableHeaderRowAsHookContract
>({ ...tableRow, name: 'as-data-table-header-row' });

export const dataTableHeaderRow = definePrototype<
  DataTableHeaderRowProps,
  DataTableHeaderRowExposes
>({
  name: 'base-data-table-header-row',
  setup() {
    return asDataTableHeaderRow().render;
  },
});
