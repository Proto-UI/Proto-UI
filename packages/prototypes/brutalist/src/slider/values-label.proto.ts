import type { SliderValuesPartExposes } from '@proto.ui/prototypes-base/slider';
import type { SliderValuesPartProps } from '@proto.ui/prototypes-base/slider';
import { definePrototype, tw } from '@proto.ui/core';
import { asSliderValuesLabel } from '@proto.ui/prototypes-base/slider';
export default definePrototype<SliderValuesPartProps, SliderValuesPartExposes>({
  name: 'brutalist-slider-values-label',
  setup(def) {
    const inherited = asSliderValuesLabel();
    def.feedback.style.use(tw('block w-full text-sm font-bold'));
    return inherited.render;
  },
});
