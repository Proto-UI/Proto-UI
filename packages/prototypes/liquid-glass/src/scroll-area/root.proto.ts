import { definePrototype, tw } from '@proto.ui/core';
import {
  asScrollAreaRoot,
  type ScrollAreaRootProps,
  type ScrollAreaRootExposes,
} from '@proto.ui/prototypes-base/scroll-area';

export default definePrototype<ScrollAreaRootProps, ScrollAreaRootExposes>({
  name: 'liquid-glass-scroll-area-root',
  modules: asScrollAreaRoot.modules,
  setup(def) {
    const inherited = asScrollAreaRoot();
    // Content boundary only: never place Liquid Glass material on the scroll
    // container itself so floating glass bars never stack glass-on-glass.
    def.feedback.style.use(
      tw('relative min-h-0 min-w-0 overflow-hidden text-foreground font-sans')
    );
    return inherited.render;
  },
});
