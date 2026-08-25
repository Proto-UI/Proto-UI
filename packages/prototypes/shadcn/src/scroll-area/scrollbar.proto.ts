import { definePrototype, tw } from '@proto.ui/core';
import { asScrollAreaScrollbar } from '@proto.ui/prototypes-base/scroll-area';
import type { ShadcnScrollAreaScrollbarExposes, ShadcnScrollAreaScrollbarProps } from './types';

const SCROLLBAR_BASE_TOKENS = 'flex touch-none select-none transition-colors absolute';

const scrollAreaScrollbar = definePrototype<
  ShadcnScrollAreaScrollbarProps,
  ShadcnScrollAreaScrollbarExposes
>({
  name: 'shadcn-scroll-area-scrollbar',
  setup(def) {
    const scrollbar = asScrollAreaScrollbar();
    const state = scrollbar.stateHandles;
    if (!state) throw new Error('[shadcn-scroll-area-scrollbar] missing state handles.');
    const { orientation } = state;

    def.feedback.style.use(tw(SCROLLBAR_BASE_TOKENS));

    // Vertical: full height, fixed width, positioned at the right edge
    def.rule({
      when: (w) => w.state(orientation).eq('vertical'),
      intent: (i) =>
        i.feedback.style.use(tw('h-full w-2.5 top-0 right-0 border-2 border-transparent')),
    });
    // Horizontal: full width, fixed height, positioned at the bottom edge
    def.rule({
      when: (w) => w.state(orientation).eq('horizontal'),
      intent: (i) =>
        i.feedback.style.use(
          tw('w-full h-2.5 flex-col bottom-0 left-0 border-2 border-transparent')
        ),
    });
  },
});
export default scrollAreaScrollbar;
