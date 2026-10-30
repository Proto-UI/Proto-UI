import { definePrototype, tw } from '@proto.ui/core';
import {
  asSliderValuesRoot,
  type SliderValuesRootProps,
  type SliderValuesRootExposes,
} from '@proto.ui/prototypes-base/slider';

export default definePrototype<SliderValuesRootProps, SliderValuesRootExposes>({
  name: 'liquid-glass-slider-values-root',
  setup(def) {
    const inherited = asSliderValuesRoot();
    // Neutral grouping; the indexed functional Thumbs own their own paint.
    def.feedback.style.use(tw('flex w-full min-w-0 flex-wrap items-center gap-3 text-foreground'));
    return inherited.render;
  },
});
