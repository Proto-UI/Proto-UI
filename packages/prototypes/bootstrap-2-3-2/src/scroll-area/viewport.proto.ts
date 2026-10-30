import { definePrototype, tw } from '@proto.ui/core';
import {
  asScrollAreaViewport,
  type ScrollAreaViewportProps,
  type ScrollAreaViewportExposes,
} from '@proto.ui/prototypes-base/scroll-area';

export default definePrototype<ScrollAreaViewportProps, ScrollAreaViewportExposes>({
  name: 'bootstrap-2-3-2-scroll-area-viewport',
  setup(def) {
    const inherited = asScrollAreaViewport();
    const state = inherited.stateHandles;
    if (!state)
      throw new Error('[bootstrap-2-3-2-scroll-area-viewport] Base focus facts required.');
    // Keep Base's auto preference: native/system is the historical default.
    // A composed-capable host may resolve the same domain to authored chrome.
    def.feedback.style.use(tw('w-full h-full min-w-0 min-h-0 rounded-[4px] outline-none'));
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('ring-2 ring-ring ring-inset forced-colors-focus-outline')),
    });
    return inherited.render;
  },
});
