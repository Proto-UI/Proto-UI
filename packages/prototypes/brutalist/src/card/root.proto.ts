import { definePrototype, tw } from '@proto.ui/core';
import type { BrutalistCardRootExposes, BrutalistCardRootProps } from './types';

// P-BRUTALIST-CARD-PASSIVE-BOUNDARY: child content owns semantics; composed controls own actions.
export const BrutalistCardRoot = definePrototype<BrutalistCardRootProps, BrutalistCardRootExposes>({
  name: 'brutalist-card-root',
  setup(def) {
    // P-BRUTALIST-CARD-ROOT-VISUAL
    def.feedback.style.use(
      tw(
        'flex flex-col gap-6 rounded-base border-2 border-black bg-background py-6 text-foreground font-sans font-medium shadow-[4px_4px_0_0_#000]'
      )
    );
    return (renderer) => [renderer.r.slot()];
  },
});
