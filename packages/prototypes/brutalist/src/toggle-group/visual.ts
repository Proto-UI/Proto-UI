import { createContextKey } from '@proto.ui/core';
import type {
  BrutalistToggleGroupSize,
  BrutalistToggleGroupSpacing,
  BrutalistToggleGroupVariant,
} from './types';

export type BrutalistToggleGroupVisualContext = {
  orientation: string;
  variant: BrutalistToggleGroupVariant;
  size: BrutalistToggleGroupSize;
  spacing: BrutalistToggleGroupSpacing;
};

/** Presentation-only transport of Base orientation and Brutalist Root visual props. */
export const TOGGLE_GROUP_VISUAL_CONTEXT = createContextKey<BrutalistToggleGroupVisualContext>(
  'brutalist-toggle-group-visual-context'
);
