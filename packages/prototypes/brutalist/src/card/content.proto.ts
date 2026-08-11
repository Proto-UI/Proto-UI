import { definePrototype, tw } from '@proto.ui/core';
import type { BrutalistCardContentExposes, BrutalistCardContentProps } from './types';
// P-BRUTALIST-CARD-CONTENT-VISUAL: child content and composed controls retain their own semantics.
export const BrutalistCardContent = definePrototype<
  BrutalistCardContentProps,
  BrutalistCardContentExposes
>({
  name: 'brutalist-card-content',
  setup(def) {
    def.feedback.style.use(tw('px-6'));
    return (renderer) => [renderer.r.slot()];
  },
});
