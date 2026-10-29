import { definePrototype, tw } from '@proto.ui/core';
import { asSelectViewport } from '@proto.ui/prototypes-base/select';
import type { LiquidGlassSelectViewportProps } from './types';

// Semantic scrollport only; Surface above owns the one paint/material slot.
export default definePrototype<LiquidGlassSelectViewportProps>({
  name: 'liquid-glass-select-viewport',
  setup(def) {
    const inherited = asSelectViewport();
    // The complete-composition scrollport. Space inside keeps item outlines
    // from being clipped, matching the withdrawn legacy Content padding.
    def.feedback.style.use(
      tw('relative flex-1 min-w-0 min-h-0 overflow-x-hidden overflow-y-auto p-2')
    );
    return inherited.render;
  },
});
