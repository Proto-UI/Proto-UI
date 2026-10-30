import { definePrototype, tw } from '@proto.ui/core';
import {
  asScrollAreaViewport,
  type ScrollAreaViewportProps,
  type ScrollAreaViewportExposes,
} from '@proto.ui/prototypes-base/scroll-area';

export default definePrototype<ScrollAreaViewportProps, ScrollAreaViewportExposes>({
  name: 'liquid-glass-scroll-area-viewport',
  setup(def) {
    const inherited = asScrollAreaViewport();
    const state = inherited.stateHandles;
    if (!state) throw new Error('[liquid-glass-scroll-area-viewport] Missing Base scroll facts.');
    // Preserve Base auto projection: the host chooses system or composed chrome
    // on the same surface lease. No CSS overflow policy or second focus owner.
    def.feedback.style.use(tw('min-h-0 min-w-0 h-full w-full outline-none'));
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('ring-2 ring-ring ring-inset forced-colors-focus-outline')),
    });
    return inherited.render;
  },
});
