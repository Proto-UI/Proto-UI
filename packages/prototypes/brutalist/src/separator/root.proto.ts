import { definePrototype, tw } from '@proto.ui/core';
import { asSeparatorRoot } from '@proto.ui/prototypes-base/separator';
import type { BrutalistSeparatorRootExposes, BrutalistSeparatorRootProps } from './types';

export const BrutalistSeparatorRoot = definePrototype<
  BrutalistSeparatorRootProps,
  BrutalistSeparatorRootExposes
>({
  name: 'brutalist-separator-root',
  setup(def) {
    // P-BRUTALIST-SEPARATOR-BASE-INHERITANCE
    // Keep Base orientation, decorative, and accessibility semantics, then style
    // from the same canonical state exposed to the web projection.
    const separatorState = asSeparatorRoot().stateHandles;
    if (!separatorState) {
      throw new Error('[brutalist-separator] asSeparatorRoot must project state handles.');
    }
    const { orientation } = separatorState;
    // P-BRUTALIST-SEPARATOR-VISUAL-GRAMMAR
    def.feedback.style.use(tw('block shrink-0 bg-foreground'));
    // P-BRUTALIST-SEPARATOR-DYNAMIC-GEOMETRY
    def.rule({
      when: (w) => w.state(orientation).eq('horizontal'),
      intent: (i) => i.feedback.style.use(tw('h-0.5 w-full')),
    });
    def.rule({
      when: (w) => w.state(orientation).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('h-full w-0.5')),
    });
  },
});
