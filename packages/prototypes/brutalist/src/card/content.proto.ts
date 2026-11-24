import { definePrototype } from '@proto.ui/core';
import { brutalistCardHorizontalPadding, setupBrutalistCardPartVisual } from './visual';
import type { BrutalistCardContentExposes, BrutalistCardContentProps } from './types';

// P-BRUTALIST-CARD-CONTENT-VISUAL: child content and composed controls retain their own semantics.
export const BrutalistCardContent = definePrototype<
  BrutalistCardContentProps,
  BrutalistCardContentExposes
>({
  name: 'brutalist-card-content',
  setup(def) {
    brutalistCardHorizontalPadding(def, setupBrutalistCardPartVisual(def));
    return (renderer) => [renderer.r.slot()];
  },
});
