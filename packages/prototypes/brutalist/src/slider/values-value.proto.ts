import type { SliderValuesPartExposes } from '@proto.ui/prototypes-base/slider';
import type { SliderValuesPartProps } from '@proto.ui/prototypes-base/slider';
import { definePrototype, tw } from '@proto.ui/core';
import { asSliderValuesValue } from '@proto.ui/prototypes-base/slider';
export default definePrototype<SliderValuesPartProps, SliderValuesPartExposes>({
  name: 'brutalist-slider-values-value',
  setup(def) {
    const inherited = asSliderValuesValue();
    def.feedback.style.use(tw('text-sm tabular-nums text-muted-foreground'));
    return inherited.render;
  },
});
