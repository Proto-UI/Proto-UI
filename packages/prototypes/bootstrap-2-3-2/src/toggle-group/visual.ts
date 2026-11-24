import { createContextKey } from '@proto.ui/core';
import type { BootstrapToggleGroupSize, BootstrapToggleGroupVariant } from './types';

export type BootstrapToggleGroupVisualContext = {
  orientation: string;
  variant: BootstrapToggleGroupVariant;
  size: BootstrapToggleGroupSize;
};

/** Presentation-only transport of the effective axis and Bootstrap btn-group options. */
export const TOGGLE_GROUP_VISUAL_AXIS = createContextKey<BootstrapToggleGroupVisualContext>(
  'bootstrap-2-3-2-toggle-group-visual-axis'
);
