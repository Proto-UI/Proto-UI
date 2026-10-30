import { definePrototype, tw } from '@proto.ui/core';
import {
  asSliderValuesLabel,
  type SliderValuesPartProps,
  type SliderValuesPartExposes,
} from '@proto.ui/prototypes-base/slider';

export default definePrototype<SliderValuesPartProps, SliderValuesPartExposes>({
  name: 'liquid-glass-slider-values-label',
  setup(def) {
    const inherited = asSliderValuesLabel();
    def.feedback.style.use(tw('block w-full text-sm font-medium'));
    return inherited.render;
  },
});
