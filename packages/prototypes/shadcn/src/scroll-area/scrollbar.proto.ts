import { definePrototype, tw } from '@proto.ui/core';
import { asScrollAreaScrollbar } from '@proto.ui/prototypes-base/scroll-area';
import { setupShadcnStyleSelection } from '../style-scope';
import type { ShadcnScrollAreaScrollbarExposes, ShadcnScrollAreaScrollbarProps } from './types';

const SCROLLBAR_SURFACE_TOKENS = 'absolute flex touch-none p-px select-none transition-colors';

const scrollAreaScrollbar = definePrototype<
  ShadcnScrollAreaScrollbarProps,
  ShadcnScrollAreaScrollbarExposes
>({
  name: 'shadcn-scroll-area-scrollbar',
  modules: asScrollAreaScrollbar.modules,
  setup(def) {
    const inherited = asScrollAreaScrollbar();
    const state = inherited.stateHandles;
    if (!state) {
      throw new Error(
        '[shadcn-scroll-area-scrollbar] asScrollAreaScrollbar must project Scrollbar state handles.'
      );
    }
    setupShadcnStyleSelection(def, 'new-york-v4');

    def.feedback.style.use(tw(SCROLLBAR_SURFACE_TOKENS));
    def.rule({
      when: (when) => when.state(state.orientation).eq('vertical'),
      intent: (intent) =>
        intent.feedback.style.use(
          tw(
            'h-[calc(100%_-_var(--proto-ui-scroll-track-end-inset,0px))] w-2.5 top-0 right-0 border-l border-transparent'
          )
        ),
    });
    def.rule({
      when: (when) => when.state(state.orientation).eq('horizontal'),
      intent: (intent) =>
        intent.feedback.style.use(
          tw(
            'w-[calc(100%_-_var(--proto-ui-scroll-track-end-inset,0px))] h-2.5 flex-col bottom-0 left-0 border-t border-transparent'
          )
        ),
    });
    // Track-end insets remain host-owned. Leave their intersection transparent
    // so the consumer's Root surface continues through it without a corner tile.
    return inherited.render;
  },
});

export default scrollAreaScrollbar;
