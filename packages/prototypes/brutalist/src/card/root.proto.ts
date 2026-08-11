import { definePrototype, tw } from '@proto.ui/core';
import type { BrutalistCardRootExposes, BrutalistCardRootProps } from './types';

// P-BRUTALIST-CARD-PASSIVE-BOUNDARY: child content owns semantics; composed controls own actions.
export const BrutalistCardRoot = definePrototype<BrutalistCardRootProps, BrutalistCardRootExposes>({
  name: 'brutalist-card-root',
  setup(def) {
    // P-BRUTALIST-CARD-ROOT-VISUAL
    def.feedback.style.use(
      tw(
        'flex flex-col gap-6 rounded-none border-2 border-foreground bg-background py-6 text-foreground shadow-[6px_6px_0_0_var(--pui-foreground)]'
      )
    );
    return (renderer) => [renderer.r.slot()];
  },
});
