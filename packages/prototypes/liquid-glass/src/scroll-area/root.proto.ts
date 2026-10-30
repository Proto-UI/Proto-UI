import { definePrototype, tw } from '@proto.ui/core';
import {
  asScrollAreaRoot,
  type ScrollAreaRootProps,
  type ScrollAreaRootExposes,
} from '@proto.ui/prototypes-base/scroll-area';

export default definePrototype<ScrollAreaRootProps, ScrollAreaRootExposes>({
  name: 'liquid-glass-scroll-area-root',
  setup(def) {
    const inherited = asScrollAreaRoot();
    // A content boundary, not a material, focus or scrolling owner.
    def.feedback.style.use(tw('relative min-h-0 min-w-0 overflow-hidden text-foreground'));
    return inherited.render;
  },
});
