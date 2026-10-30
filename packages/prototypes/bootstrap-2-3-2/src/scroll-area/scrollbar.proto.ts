import { definePrototype, tw } from '@proto.ui/core';
import {
  asScrollAreaScrollbar,
  type ScrollAreaScrollbarProps,
  type ScrollAreaScrollbarExposes,
} from '@proto.ui/prototypes-base/scroll-area';

export default definePrototype<ScrollAreaScrollbarProps, ScrollAreaScrollbarExposes>({
  name: 'bootstrap-2-3-2-scroll-area-scrollbar',
  setup(def) {
    const inherited = asScrollAreaScrollbar();
    const state = inherited.stateHandles;
    if (!state)
      throw new Error('[bootstrap-2-3-2-scroll-area-scrollbar] Base orientation required.');
    // This 12px composed track is a Proto extension, not a native scrollbar skin.
    // Its gray palette and 4px corners come from the pinned forms/button grammar.
    def.feedback.style.use(
      tw('absolute flex touch-none select-none rounded-[4px] border border-[#ccc] bg-[#eee]')
    );
    def.rule({
      when: (w) => w.state(state.orientation).eq('vertical'),
      intent: (i) =>
        i.feedback.style.use(
          tw('top-0 right-0 w-[12px] h-[calc(100%_-_var(--proto-ui-scroll-track-end-inset,0px))]')
        ),
    });
    def.rule({
      when: (w) => w.state(state.orientation).eq('horizontal'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'bottom-0 left-0 h-[12px] w-[calc(100%_-_var(--proto-ui-scroll-track-end-inset,0px))] flex-col'
          )
        ),
    });
    // The host owns end insets, thumb geometry, input leases and system fallback.
    return inherited.render;
  },
});
