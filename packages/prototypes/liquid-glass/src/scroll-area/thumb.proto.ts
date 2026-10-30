import { definePrototype, tw } from '@proto.ui/core';
import {
  asScrollAreaThumb,
  type ScrollAreaThumbProps,
  type ScrollAreaThumbExposes,
} from '@proto.ui/prototypes-base/scroll-area';

export default definePrototype<ScrollAreaThumbProps, ScrollAreaThumbExposes>({
  name: 'liquid-glass-scroll-area-thumb',
  setup(def) {
    const inherited = asScrollAreaThumb();
    def.feedback.style.use(
      tw('relative flex-1 rounded-full border border-transparent bg-muted-foreground')
    );
    return inherited.render;
  },
});
