import { definePrototype, tw } from '@proto.ui/core';
import type { ShadcnCardHeaderProps, ShadcnCardHeaderExposes } from './types';

// P-SHADCN-CARD-HEADER-VISUAL: passive source-aligned presentation.
export const ShadcnCardHeader = definePrototype<ShadcnCardHeaderProps, ShadcnCardHeaderExposes>({
  name: 'shadcn-card-header',
  setup(def) {
    def.feedback.style.use(tw('grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6'));
    return (renderer) => [renderer.r.slot()];
  },
});
