import type {
  TableRootExposes,
  TableRootProps,
  TableCaptionExposes,
  TableCaptionProps,
  TableRowExposes,
  TableHeaderCellProps,
  TableHeaderCellExposes,
  TableCellProps,
  TableCellExposes,
} from '@proto.ui/prototypes-base/table';

export interface BrutalistTableRootProps extends TableRootProps {}
export type BrutalistTableRootExposes = TableRootExposes;

export interface BrutalistTableCaptionProps extends TableCaptionProps {}
export type BrutalistTableCaptionExposes = TableCaptionExposes;

/**
 * Caller-supplied visual membership for the family's section recipe.
 * This does not declare a Table Structure row-group or change accessibility.
 */
export type BrutalistTableSection = 'header' | 'body' | 'footer';
export interface BrutalistTableRowProps {
  /** Caller identifies the authored visual section; defaults to body. */
  section?: BrutalistTableSection;
  /**
   * Caller marks each section's final row, including after reordering;
   * defaults to false. Body and footer final rows withdraw their bottom rule;
   * header rows retain it. No DOM order or semantic row-group is inferred.
   */
  lastInSection?: boolean;
}
export type BrutalistTableRowExposes = TableRowExposes;

export interface BrutalistTableHeaderCellProps extends TableHeaderCellProps {}
export type BrutalistTableHeaderCellExposes = TableHeaderCellExposes;

export interface BrutalistTableCellProps extends TableCellProps {}
export type BrutalistTableCellExposes = TableCellExposes;
