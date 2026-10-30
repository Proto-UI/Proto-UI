import { definePrototype, tw } from '@proto.ui/core';
import {
  asSeparatorRoot,
  type SeparatorRootExposes,
  type SeparatorRootProps,
} from '@proto.ui/prototypes-base/separator';

// Ordinary content separation, not a functional material surface. Base owns
// orientation, decorative visibility and semantic separator accessibility.
export default definePrototype<SeparatorRootProps, SeparatorRootExposes>({
  name: 'liquid-glass-separator-root',
  setup(def) {
    const inherited = asSeparatorRoot();
    const state = inherited.stateHandles;
    if (!state)
      throw new Error('[liquid-glass-separator-root] Base Separator states are required.');
    def.feedback.style.use(tw('shrink-0 bg-border'));
    def.rule({
      when: (w) => w.state(state.orientation).eq('horizontal'),
      intent: (i) => i.feedback.style.use(tw('h-px w-full')),
    });
    def.rule({
      when: (w) => w.state(state.orientation).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('h-full w-px')),
    });
    // Preserve contentless rendering: decorative semantics cannot hide children.
    return inherited.render;
  },
});
