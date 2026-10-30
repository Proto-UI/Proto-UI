import { definePrototype, tw } from '@proto.ui/core';
import {
  asScrollAreaThumb,
  type ScrollAreaThumbProps,
  type ScrollAreaThumbExposes,
} from '@proto.ui/prototypes-base/scroll-area';

export default definePrototype<ScrollAreaThumbProps, ScrollAreaThumbExposes>({
  name: 'bootstrap-2-3-2-scroll-area-thumb',
  setup(def) {
    const inherited = asScrollAreaThumb();
    def.feedback.style.use(
      tw('relative flex-1 rounded-[4px] border border-[#b3b3b3] bg-[#e6e6e6]')
    );
    return inherited.render;
  },
});
