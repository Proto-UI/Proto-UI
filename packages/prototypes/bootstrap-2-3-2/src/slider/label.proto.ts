import type { SliderPartExposes } from '@proto.ui/prototypes-base/slider';
import type { SliderPartProps } from '@proto.ui/prototypes-base/slider';
import { definePrototype, tw } from '@proto.ui/core';
import { asSliderLabel } from '@proto.ui/prototypes-base/slider';
export default definePrototype<SliderPartProps, SliderPartExposes>({
  name: 'bootstrap-2-3-2-slider-label',
  setup(def) {
    const inherited = asSliderLabel();
    def.feedback.style.use(tw('block w-full text-sm font-medium'));
    return inherited.render;
  },
});
