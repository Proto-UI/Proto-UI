import { definePrototype, tw } from '@proto.ui/core';
import type { ShadcnCardFooterProps, ShadcnCardFooterExposes } from './types';

// P-SHADCN-CARD-FOOTER-VISUAL: passive source-aligned presentation.
export const ShadcnCardFooter = definePrototype<ShadcnCardFooterProps, ShadcnCardFooterExposes>({
  name: 'shadcn-card-footer',
  setup(def) {
    def.feedback.style.use(tw('flex items-center px-6'));
    return (renderer) => [renderer.r.slot()];
  },
});
