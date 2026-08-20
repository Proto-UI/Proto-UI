import { definePrototype, tw } from '@proto.ui/core';
import type { BrutalistCardFooterExposes, BrutalistCardFooterProps } from './types';
// P-BRUTALIST-CARD-FOOTER-VISUAL: child content and composed controls retain their own semantics.
export const BrutalistCardFooter = definePrototype<
  BrutalistCardFooterProps,
  BrutalistCardFooterExposes
>({
  name: 'brutalist-card-footer',
  setup(def) {
    def.feedback.style.use(
      tw('flex items-center justify-between gap-4 border-t-2 border-foreground px-6 pt-4')
    );
    return (renderer) => [renderer.r.slot()];
  },
});
