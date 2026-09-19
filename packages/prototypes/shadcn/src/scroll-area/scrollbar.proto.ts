import { definePrototype, tw } from '@proto.ui/core';
import { asScrollAreaScrollbar } from '@proto.ui/prototypes-base/scroll-area';
import type { ShadcnScrollAreaScrollbarExposes, ShadcnScrollAreaScrollbarProps } from './types';

const SCROLLBAR_SURFACE_TOKENS = 'absolute flex touch-none select-none transition-colors';

const scrollAreaScrollbar = definePrototype<
  ShadcnScrollAreaScrollbarProps,
  ShadcnScrollAreaScrollbarExposes
>({
  name: 'shadcn-scroll-area-scrollbar',
  setup(def) {
    const state = asScrollAreaScrollbar().stateHandles;
    if (!state) {
      throw new Error(
        '[shadcn-scroll-area-scrollbar] asScrollAreaScrollbar must project Scrollbar state handles.'
      );
    }

    def.feedback.style.use(tw(SCROLLBAR_SURFACE_TOKENS));
    def.rule({
      when: (when) => when.state(state.orientation).eq('vertical'),
      intent: (intent) =>
        intent.feedback.style.use(tw('h-full w-2.5 top-0 right-0 border-2 border-transparent')),
    });
    def.rule({
      when: (when) => when.state(state.orientation).eq('horizontal'),
      intent: (intent) =>
        intent.feedback.style.use(
          tw('w-full h-2.5 flex-col bottom-0 left-0 border-2 border-transparent')
        ),
    });
  },
});

export default scrollAreaScrollbar;
