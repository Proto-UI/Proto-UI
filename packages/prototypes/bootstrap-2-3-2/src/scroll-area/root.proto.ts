import { definePrototype, tw } from '@proto.ui/core';
import {
  asScrollAreaRoot,
  type ScrollAreaRootProps,
  type ScrollAreaRootExposes,
} from '@proto.ui/prototypes-base/scroll-area';

// Proto extension: Bootstrap 2.3.2 has no authored Scroll Area component.
// Root is only the family layout boundary; Viewport remains the sole scroll owner.
export default definePrototype<ScrollAreaRootProps, ScrollAreaRootExposes>({
  name: 'bootstrap-2-3-2-scroll-area-root',
  setup(def) {
    const inherited = asScrollAreaRoot();
    def.feedback.style.use(tw('relative min-w-0 min-h-0 overflow-hidden'));
    return inherited.render;
  },
});
