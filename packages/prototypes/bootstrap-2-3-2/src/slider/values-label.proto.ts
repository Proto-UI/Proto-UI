import { definePrototype, tw } from '@proto.ui/core';
import {
  asSliderValuesLabel,
  type SliderValuesPartProps,
  type SliderValuesPartExposes,
} from '@proto.ui/prototypes-base/slider';

export default definePrototype<SliderValuesPartProps, SliderValuesPartExposes>({
  name: 'bootstrap-2-3-2-slider-values-label',
  setup(def) {
    const inherited = asSliderValuesLabel();
    def.feedback.style.use(tw('block w-full mb-[5px] text-[14px] leading-[20px] font-normal'));
    return inherited.render;
  },
});
