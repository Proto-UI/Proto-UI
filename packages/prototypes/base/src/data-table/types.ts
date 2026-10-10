import type {
  CollectionExposes,
  CollectionItemExposes,
  ExposeEvent,
  ExposeMethod,
  ExposeState,
  State,
} from '@proto.ui/core';
import type { asButton, ButtonExposes, ButtonProps } from '../button';
import type {
  TableRootExposes,
  TableCellProps,
  TableHeaderCellProps,
  TableCaptionProps,
  TableCaptionExposes,
} from '../table';
import type { DataRecord, SortDirection } from './model';
export interface DataTableRootProps {
  rows?: readonly DataRecord[];
  sortKey?: string;
  defaultSortKey?: string;
  sortDirection?: SortDirection;
  defaultSortDirection?: SortDirection;
  filter?: string;
  page?: number;
  defaultPage?: number;
  pageSize?: number;
  selectedKeys?: readonly string[];
  defaultSelectedKeys?: readonly string[];
  disabled?: boolean;
  readOnly?: boolean;
}
export interface DataTableRowProps {
  index?: number;
  header?: boolean;
}
export type DataTableCellProps = TableCellProps & { columnKey?: string };
export type DataTableHeaderProps = TableHeaderCellProps & { sortable?: boolean };
export type DataTableCaptionProps = TableCaptionProps;
export type DataTablePreviousProps = ButtonProps;
export type DataTableNextProps = ButtonProps;
export type DataTableRootExposes = TableRootExposes &
  CollectionExposes & {
    filteredCount: ExposeState<number>;
    sortChange: ExposeEvent<{ sortKey: string; sortDirection: SortDirection }>;
    pageChange: ExposeEvent<{ page: number }>;
    selectionChange: ExposeEvent<{ selectedKeys: string[] }>;
    getRows: ExposeMethod<() => DataRecord[]>;
    getRecord: ExposeMethod<(id: string) => DataRecord | null>;
    requestSort: ExposeMethod<(key: string) => boolean>;
    requestPage: ExposeMethod<(next: number) => boolean>;
    requestSelection: ExposeMethod<(id: string) => boolean>;
  };
export type DataTableRowExposes = CollectionItemExposes & {
  rowKey: ExposeState<string>;
  selected: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
};
export type DataTableCellExposes = { displayValue: ExposeState<string> };
export type DataTableHeaderExposes = { sort: ExposeState<string> };
export type DataTableCaptionExposes = TableCaptionExposes;
export type DataTablePreviousExposes = ButtonExposes;
export type DataTableNextExposes = ButtonExposes;
export type DataTableRootAsHookContract = {
  state: { collectionCount: State<number>; filteredCount: State<number> };
  event: {
    sortChange: { sortKey: string; sortDirection: SortDirection };
    pageChange: { page: number };
    selectionChange: { selectedKeys: string[] };
  };
};
export type DataTableRowAsHookContract = {
  state: {
    collectionIndex: State<number>;
    collectionTotal: State<number>;
    collectionFirst: State<boolean>;
    collectionLast: State<boolean>;
    rowKey: State<string>;
    selected: State<boolean>;
    hidden: State<boolean>;
    focused: State<boolean>;
    focusVisible: State<boolean>;
  };
};
export type DataTableCellAsHookContract = { state: { displayValue: State<string> } };
export type DataTableHeaderAsHookContract = { state: { sort: State<string> } };
export type DataTableCaptionAsHookContract = {};
export type DataTablePreviousAsHookContract = {
  asHooks: { 'as-button': ReturnType<typeof asButton> };
};
export type DataTableNextAsHookContract = DataTablePreviousAsHookContract;
