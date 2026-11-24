import { createContextKey } from '@proto.ui/core';
import type { LiquidGlassToggleGroupSize, LiquidGlassToggleGroupVariant } from './types';

export type LiquidGlassToggleGroupVisualContext = {
  orientation: string;
  variant: LiquidGlassToggleGroupVariant;
  size: LiquidGlassToggleGroupSize;
};

/** Presentation-only transport for concentric radii, size, and prominence hierarchy. */
export const TOGGLE_GROUP_VISUAL_CONTEXT = createContextKey<LiquidGlassToggleGroupVisualContext>(
  'liquid-glass-toggle-group-visual-context'
);
