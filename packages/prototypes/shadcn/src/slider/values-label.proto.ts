import { definePrototype, tw } from '@proto.ui/core';
import {
  asSliderValuesLabel,
  type SliderValuesPartProps,
  type SliderValuesPartExposes,
} from '@proto.ui/prototypes-base/slider';

export default definePrototype<SliderValuesPartProps, SliderValuesPartExposes>({
  name: 'shadcn-slider-values-label',
  setup(def) {
    const inherited = asSliderValuesLabel();
    // Proto label extension: upstream Slider's recipe has no rendered Label.
    def.feedback.style.use(tw('block w-full text-sm font-medium'));
    return inherited.render;
  },
});
