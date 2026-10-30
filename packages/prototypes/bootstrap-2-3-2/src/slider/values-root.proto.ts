import { definePrototype, tw } from '@proto.ui/core';
import {
  asSliderValuesRoot,
  type SliderValuesRootProps,
  type SliderValuesRootExposes,
} from '@proto.ui/prototypes-base/slider';

// Bootstrap 2.3.2 has no multi-thumb Slider. This is a Proto extension using
// its forms/buttons palette, 14px/20px type and 4px corner vocabulary.
export default definePrototype<SliderValuesRootProps, SliderValuesRootExposes>({
  name: 'bootstrap-2-3-2-slider-values-root',
  setup(def) {
    const inherited = asSliderValuesRoot();
    def.feedback.style.use(
      tw(
        'flex w-full min-w-0 flex-wrap items-center gap-[10px] text-foreground text-[14px] leading-[20px]'
      )
    );
    return inherited.render;
  },
});
