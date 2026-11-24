import { definePrototype, tw } from '@proto.ui/core';
import {
  asScrollAreaRoot,
  type ScrollAreaRootProps,
  type ScrollAreaRootExposes,
} from '@proto.ui/prototypes-base/scroll-area';

// Proto extension: Bootstrap 2.3.2 has no authored Scroll Area component.
// Root frames the scroll surface with the classic 4px bordered container grammar;
// Viewport remains the sole scroll owner.
export default definePrototype<ScrollAreaRootProps, ScrollAreaRootExposes>({
  name: 'bootstrap-2-3-2-scroll-area-root',
  modules: asScrollAreaRoot.modules,
  setup(def) {
    const inherited = asScrollAreaRoot();
    def.feedback.style.use(
      tw(
        'relative min-w-0 min-h-0 overflow-hidden rounded-[4px] border border-[#ccc] bg-[#fff] text-[#333] font-sans shadow-[inset_0_1px_1px_rgb(0_0_0/7.5%)]'
      )
    );
    return inherited.render;
  },
});
