import { definePrototype, tw } from '@proto.ui/core';
import {
  asScrollAreaThumb,
  type ScrollAreaThumbProps,
  type ScrollAreaThumbExposes,
} from '@proto.ui/prototypes-base/scroll-area';

export default definePrototype<ScrollAreaThumbProps, ScrollAreaThumbExposes>({
  name: 'bootstrap-2-3-2-scroll-area-thumb',
  modules: asScrollAreaThumb.modules,
  setup(def) {
    const inherited = asScrollAreaThumb();
    // Fill the track cross-axis cleanly; the Scroll host owns scrolling-axis
    // extent and flex-grow: 0, so flex-1 would leave a zero basis on an empty thumb.
    def.feedback.style.use(
      tw(
        'relative h-full w-full rounded-[4px] border border-[#b3b3b3] bg-[linear-gradient(#fff,#e6e6e6)] shadow-[inset_0_1px_0_rgb(255_255_255/20%),0_1px_2px_rgb(0_0_0/5%)]'
      )
    );
    def.rule({
      when: (w) => w.meta('preference.forcedColors').eq('active'),
      intent: (i) => i.feedback.style.use(tw('box-border border border-current')),
    });
    return inherited.render;
  },
});
