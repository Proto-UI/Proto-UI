import { definePrototype } from '@proto.ui/core';
import { setupCardPartVisual, cardHorizontalPadding } from './visual';
import type { ShadcnCardContentProps, ShadcnCardContentExposes } from './types';
export const ShadcnCardContent = definePrototype<ShadcnCardContentProps, ShadcnCardContentExposes>({
  name: 'shadcn-card-content',
  setup(def) {
    cardHorizontalPadding(def, setupCardPartVisual(def));
    return (r) => [r.r.slot()];
  },
});
