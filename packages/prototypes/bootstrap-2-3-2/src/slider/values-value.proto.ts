import { definePrototype, tw } from '@proto.ui/core';
import {
  asSliderValuesValue,
  type SliderValuesPartProps,
  type SliderValuesPartExposes,
} from '@proto.ui/prototypes-base/slider';

export default definePrototype<SliderValuesPartProps, SliderValuesPartExposes>({
  name: 'bootstrap-2-3-2-slider-values-value',
  setup(def) {
    const inherited = asSliderValuesValue();
    def.feedback.style.use(tw('text-[14px] leading-[20px] tabular-nums text-muted-foreground'));
    return inherited.render;
  },
});
