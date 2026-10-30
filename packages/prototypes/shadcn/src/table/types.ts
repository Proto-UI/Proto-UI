import type {
  TableRootExposes,
  TableCaptionExposes,
  TableRowExposes,
  TableHeaderCellProps,
  TableHeaderCellExposes,
  TableCellProps,
  TableCellExposes,
} from '@proto.ui/prototypes-base/table';
import type { ShadcnStyleProps } from '../style-scope';

export type ShadcnTableRootProps = ShadcnStyleProps;
export type ShadcnTableRootExposes = TableRootExposes;
export type ShadcnTableCaptionProps = ShadcnStyleProps;
export type ShadcnTableCaptionExposes = TableCaptionExposes;
/**
 * Caller-supplied visual membership for Shadcn's upstream section recipe.
 * This does not declare a Table Structure row-group or change accessibility.
 */
export type ShadcnTableSection = 'header' | 'body' | 'footer';
export type ShadcnTableRowProps = ShadcnStyleProps & {
  /** Caller identifies the upstream visual section; defaults to body. */
  section?: ShadcnTableSection;
  /**
   * Caller marks each section's final row, including after reordering;
   * defaults to false. Body and footer final rows withdraw their bottom rule;
   * header rows retain it. No DOM order or semantic row-group is inferred.
   */
  lastInSection?: boolean;
};
export type ShadcnTableRowExposes = TableRowExposes;
export type ShadcnTableHeaderCellProps = TableHeaderCellProps & ShadcnStyleProps;
export type ShadcnTableHeaderCellExposes = TableHeaderCellExposes;
export type ShadcnTableCellProps = TableCellProps & ShadcnStyleProps;
export type ShadcnTableCellExposes = TableCellExposes;
