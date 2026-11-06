import type { ControlLabelSelectionPolicy } from '@proto.ui/core';

export interface LabelRootProps {
  naming?: boolean;
  activation?: boolean;
  /**
   * Explicit text-selection policy for the label subject. The default 'policy'
   * suppresses accidental selection only while the label is actionable and
   * keeps naming-only labels selectable (C-CONTROL-LABEL-0001-CONTENT).
   */
  selection?: ControlLabelSelectionPolicy;
}
export type LabelRootExposes = {};
