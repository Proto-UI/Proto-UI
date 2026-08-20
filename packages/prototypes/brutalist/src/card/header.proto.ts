import { definePrototype, tw } from '@proto.ui/core';
import type { BrutalistCardHeaderExposes, BrutalistCardHeaderProps } from './types';
// P-BRUTALIST-CARD-HEADER-VISUAL: child content and composed controls retain their own semantics.
export const BrutalistCardHeader = definePrototype<
  BrutalistCardHeaderProps,
  BrutalistCardHeaderExposes
>({
  name: 'brutalist-card-header',
  setup(def) {
    def.feedback.style.use(
      tw('flex items-start justify-between gap-4 border-b-2 border-foreground px-6 pb-4')
    );
    return (renderer) => [renderer.r.slot()];
  },
});
