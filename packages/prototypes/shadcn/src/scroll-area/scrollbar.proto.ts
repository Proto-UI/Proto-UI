import { definePrototype, tw } from '@proto.ui/core';
import { asScrollAreaScrollbar } from '@proto.ui/prototypes-base/scroll-area';
import type { ShadcnScrollAreaScrollbarExposes, ShadcnScrollAreaScrollbarProps } from './types';

const SCROLLBAR_BASE_TOKENS = 'flex touch-none select-none transition-colors';

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

    // Composed scrollbars need axis geometry so the host can measure the track
    def.rule({
      when: (w) => w.state(orientation).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('h-full w-2.5 border-2 border-transparent')),
    });
    def.rule({
      when: (w) => w.state(orientation).eq('horizontal'),
      intent: (i) => i.feedback.style.use(tw('w-full h-2.5 border-2 border-transparent')),
    });
  },
});
export default scrollAreaScrollbar;
