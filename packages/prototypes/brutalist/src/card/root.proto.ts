import { definePrototype, tw } from '@proto.ui/core';
import { setupBrutalistCardRootVisual } from './visual';
import type { BrutalistCardRootExposes, BrutalistCardRootProps } from './types';

// P-BRUTALIST-CARD-PASSIVE-BOUNDARY: child content owns semantics; composed controls own actions.
export const BrutalistCardRoot = definePrototype<BrutalistCardRootProps, BrutalistCardRootExposes>({
  name: 'brutalist-card-root',
  setup(def) {
    const { size } = setupBrutalistCardRootVisual(def);
    // P-BRUTALIST-CARD-ROOT-VISUAL
    def.feedback.style.use(
      tw(
        'flex flex-col rounded-base border-2 border-black bg-background text-foreground font-sans font-medium shadow-[4px_4px_0_0_#000]'
      )
    );
    def.rule({
      when: (w) => w.state(size).eq('default'),
      intent: (i) => i.feedback.style.use(tw('gap-6 py-6')),
    });
    def.rule({
      when: (w) => w.state(size).eq('sm'),
      intent: (i) => i.feedback.style.use(tw('gap-4 py-4')),
    });
    return (renderer) => [renderer.r.slot()];
  },
});
