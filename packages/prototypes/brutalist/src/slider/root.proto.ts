import type { SliderRootProps, SliderRootExposes } from '@proto.ui/prototypes-base/slider';
import { definePrototype, tw } from '@proto.ui/core';
import { asSliderRoot } from '@proto.ui/prototypes-base/slider';
export default definePrototype<SliderRootProps, SliderRootExposes>({
  name: 'brutalist-slider-root',
  setup(def) {
    const inherited = asSliderRoot();
    def.feedback.style.use(tw('flex w-full min-w-0 flex-wrap items-center gap-3 text-foreground'));
    return inherited.render;
  },
});
