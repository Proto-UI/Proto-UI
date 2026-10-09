import { definePrototype, tw } from '@proto.ui/core';
import type { ShadcnCardRootProps, ShadcnCardRootExposes } from './types';

// P-SHADCN-CARD-VISUAL: passive source-aligned presentation.
export const ShadcnCardRoot = definePrototype<ShadcnCardRootProps, ShadcnCardRootExposes>({
  name: 'shadcn-card-root',
  setup(def) {
    // Make the upstream global border-border reset explicit for standalone consumers.
    def.feedback.style.use(
      tw(
        'flex flex-col gap-6 rounded-xl border border-border bg-card py-6 text-card-foreground shadow-sm'
      )
    );
    return (renderer) => [renderer.r.slot()];
  },
});
