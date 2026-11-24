import type {
  TableRootExposes,
  TableCaptionProps,
  TableCaptionExposes,
  TableRowExposes,
  TableHeaderCellProps,
  TableHeaderCellExposes,
  TableCellProps,
  TableCellExposes,
} from '@proto.ui/prototypes-base/table';

export interface BootstrapTableRootProps {
  /** Applies the classic Bootstrap 2.3.2 `.table-bordered` outer frame and 4px radius. */
  bordered?: boolean;
}
export type BootstrapTableRootExposes = TableRootExposes;

export type BootstrapTableCaptionProps = TableCaptionProps;
export type BootstrapTableCaptionExposes = TableCaptionExposes;

/**
 * Caller-supplied visual membership for Bootstrap 2.3.2 row presentation.
 * Does not declare a Table Structure row-group or change accessibility.
 */
export type BootstrapTableSection = 'header' | 'body' | 'footer';
export type BootstrapTableRowTone = 'default' | 'info' | 'warning' | 'error';

export interface BootstrapTableRowProps {
  /** Caller identifies the visual section; defaults to `'body'`. */
  section?: BootstrapTableSection;
  /** Applies Bootstrap 2.3.2 `.table-striped` secondary tint on body rows. */
  striped?: boolean;
  /** Enables passive Bootstrap 2.3.2 `.table-hover` highlight on body rows. */
  hoverable?: boolean;
  /** Applies classic Bootstrap 2.3.2 contextual row coloring (`info` | `warning` | `error`). */
  tone?: BootstrapTableRowTone;
}
export type BootstrapTableRowExposes = TableRowExposes;

export interface BootstrapTableHeaderCellProps extends TableHeaderCellProps {
  /** Applies Bootstrap 2.3.2 `.table-condensed` padding (`4px 5px`). */
  condensed?: boolean;
  /** Applies a leading vertical cell rule for `.table-bordered` layouts. */
  bordered?: boolean;
}
export type BootstrapTableHeaderCellExposes = TableHeaderCellExposes;

export interface BootstrapTableCellProps extends TableCellProps {
  /** Applies Bootstrap 2.3.2 `.table-condensed` padding (`4px 5px`). */
  condensed?: boolean;
  /** Applies a leading vertical cell rule for `.table-bordered` layouts. */
  bordered?: boolean;
}
export type BootstrapTableCellExposes = TableCellExposes;
