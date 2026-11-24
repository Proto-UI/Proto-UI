import { createContextKey } from '@proto.ui/core';
import type { ShadcnToggleSize, ShadcnToggleVariant } from '../toggle/types';

export type ToggleGroupVisualContext = {
  orientation: string;
  variant: ShadcnToggleVariant;
  size: ShadcnToggleSize;
  /** Effective spacing token (`0` = joined, `1` = gap-1, `2` = gap-2). */
  spacing: 0 | 1 | 2;
};

/** Read-only transport of Base's axis and Root visual choices for presentation only. */
export const TOGGLE_GROUP_VISUAL_AXIS = createContextKey<ToggleGroupVisualContext>(
  'shadcn-toggle-group-visual-axis'
);
