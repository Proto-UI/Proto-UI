import type { SliderRootProps, SliderRootExposes } from '@proto.ui/prototypes-base/slider';
import { definePrototype, tw } from '@proto.ui/core';
import { asSliderRoot } from '@proto.ui/prototypes-base/slider';
export default definePrototype<SliderRootProps, SliderRootExposes>({
  name: 'bootstrap-2-3-2-slider-root',
  setup(def) {
    const inherited = asSliderRoot();
    // Proto extension: Bootstrap 2.3.2 had no Slider. Base owns every value,
    // input session and preview; only the historical visual vocabulary is used.
    def.feedback.style.use(
      tw(
        'flex w-full min-w-0 flex-wrap items-center gap-[10px] text-foreground text-[14px] leading-[20px]'
      )
    );
    return inherited.render;
  },
});
