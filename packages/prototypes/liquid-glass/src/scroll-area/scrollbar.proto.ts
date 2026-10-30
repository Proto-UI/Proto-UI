import { definePrototype, tw } from '@proto.ui/core';
import {
  asScrollAreaScrollbar,
  type ScrollAreaScrollbarProps,
  type ScrollAreaScrollbarExposes,
} from '@proto.ui/prototypes-base/scroll-area';

export default definePrototype<ScrollAreaScrollbarProps, ScrollAreaScrollbarExposes>({
  name: 'liquid-glass-scroll-area-scrollbar',
  setup(def) {
    const inherited = asScrollAreaScrollbar();
    const state = inherited.stateHandles;
    if (!state) throw new Error('[liquid-glass-scroll-area-scrollbar] Missing Base orientation.');
    def.feedback.style.use(tw('absolute flex touch-none select-none border-2 border-transparent'));
    def.rule({
      when: (w) => w.state(state.orientation).eq('vertical'),
      intent: (i) =>
        i.feedback.style.use(
          tw('top-0 right-0 w-2.5 h-[calc(100%_-_var(--proto-ui-scroll-track-end-inset,0px))]')
        ),
    });
    def.rule({
      when: (w) => w.state(state.orientation).eq('horizontal'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'bottom-0 left-0 h-2.5 w-[calc(100%_-_var(--proto-ui-scroll-track-end-inset,0px))] flex-col'
          )
        ),
    });
    // Host chrome owns pointer sessions, axis resolution and track-end insets;
    // it also hides these authored parts when system projection is selected.
    return inherited.render;
  },
});
