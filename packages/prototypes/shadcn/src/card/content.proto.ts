import { definePrototype, tw } from '@proto.ui/core';
import type { ShadcnCardContentProps, ShadcnCardContentExposes } from './types';

// P-SHADCN-CARD-CONTENT-VISUAL: passive source-aligned presentation.
export const ShadcnCardContent = definePrototype<ShadcnCardContentProps, ShadcnCardContentExposes>({
  name: 'shadcn-card-content',
  setup(def) {
    def.feedback.style.use(tw('px-6'));
    return (renderer) => [renderer.r.slot()];
  },
});
