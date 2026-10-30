import type { SliderPartExposes } from '@proto.ui/prototypes-base/slider';
import type { SliderPartProps } from '@proto.ui/prototypes-base/slider';
import { definePrototype, tw } from '@proto.ui/core';
import { asSliderValue } from '@proto.ui/prototypes-base/slider';
export default definePrototype<SliderPartProps, SliderPartExposes>({
  name: 'bootstrap-2-3-2-slider-value',
  setup(def) {
    const inherited = asSliderValue();
    def.feedback.style.use(tw('text-[14px] leading-[20px] tabular-nums text-[#555]'));
    return inherited.render;
  },
});
