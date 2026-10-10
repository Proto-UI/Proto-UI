import type { SliderPartProps } from '@proto.ui/prototypes-base/slider';
import { definePrototype, tw } from '@proto.ui/core';
import { asSliderLabel } from '@proto.ui/prototypes-base/slider';
export default definePrototype<SliderPartProps, Record<string, unknown>>({
  name: 'shadcn-slider-label',
  setup(def) {
    const inherited = asSliderLabel();
    def.feedback.style.use(tw('block w-full text-sm font-medium'));
    return inherited.render;
  },
});
