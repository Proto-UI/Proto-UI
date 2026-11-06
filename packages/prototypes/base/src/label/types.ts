import type { ControlLabelSelectionPolicy } from '@proto.ui/core';

export interface LabelRootProps {
  /** Name the paired target from this rendered label. Defaults to true. */
  naming?: boolean;
  /**
   * Request the explicitly associated target's own operation. Defaults to true;
   * false keeps a naming-only label. Never discovers a target by DOM ancestry.
   */
  activation?: boolean;
  /**
   * Explicit text-selection policy for the label subject. The default 'policy'
   * suppresses accidental selection only while the label is actionable and
   * keeps naming-only labels selectable (C-CONTROL-LABEL-0001-CONTENT).
   */
  selection?: ControlLabelSelectionPolicy;
}
export type LabelRootExposes = {};
