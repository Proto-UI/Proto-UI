import { definePrototype, tw } from '@proto.ui/core';
import { asSeparatorRoot } from '@proto.ui/prototypes-base/separator';
import type { BrutalistSeparatorRootExposes, BrutalistSeparatorRootProps } from './types';

export const BrutalistSeparatorRoot = definePrototype<
  BrutalistSeparatorRootProps,
  BrutalistSeparatorRootExposes
>({
  name: 'brutalist-separator-root',
  modules: asSeparatorRoot.modules,
  setup(def) {
    // P-BRUTALIST-SEPARATOR-BASE-INHERITANCE
    // Keep Base orientation, decorative, and accessibility semantics, then style
    // from the same canonical state exposed to the web projection.
    const inherited = asSeparatorRoot();
    const separatorState = inherited.stateHandles;
    if (!separatorState) {
      throw new Error('[brutalist-separator] asSeparatorRoot must project state handles.');
    }
    const { orientation } = separatorState;
    // P-BRUTALIST-SEPARATOR-VISUAL-GRAMMAR
    def.feedback.style.use(tw('block shrink-0 bg-foreground'));
    // P-BRUTALIST-SEPARATOR-DYNAMIC-GEOMETRY
    def.rule({
      when: (w) => w.state(orientation).eq('horizontal'),
      intent: (i) => i.feedback.style.use(tw('h-[2px] w-full')),
    });
    def.rule({
      when: (w) => w.state(orientation).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('w-[2px] self-stretch')),
    });
    // P-BASE-SEPARATOR-CONTENTLESS: forward Base's contentless renderer so
    // authored descendants can never be hidden by decorative semantics.
    return inherited.render;
  },
});
