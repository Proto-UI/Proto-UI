import type {
  TableRootProps,
  TableRootExposes,
  TableCaptionProps,
  TableCaptionExposes,
  TableRowExposes,
  TableHeaderCellProps,
  TableHeaderCellExposes,
  TableCellProps,
  TableCellExposes,
} from '@proto.ui/prototypes-base/table';

export type LiquidGlassTableRootProps = TableRootProps;
export type LiquidGlassTableRootExposes = TableRootExposes;
export type LiquidGlassTableCaptionProps = TableCaptionProps;
export type LiquidGlassTableCaptionExposes = TableCaptionExposes;

/**
 * Caller-supplied visual membership for content-layer row dividers and footer emphasis.
 * Does not declare a Table Structure row-group, material surface, or change accessibility.
 */
export type LiquidGlassTableSection = 'header' | 'body' | 'footer';
export interface LiquidGlassTableRowProps {
  /** Caller identifies the visual section; defaults to `'body'`. */
  section?: LiquidGlassTableSection;
  /** Suppresses the trailing bottom rule on final body/footer rows; defaults to `false`. */
  lastInSection?: boolean;
}
export type LiquidGlassTableRowExposes = TableRowExposes;

export type LiquidGlassTableHeaderCellProps = TableHeaderCellProps;
export type LiquidGlassTableHeaderCellExposes = TableHeaderCellExposes;
export type LiquidGlassTableCellProps = TableCellProps;
export type LiquidGlassTableCellExposes = TableCellExposes;
