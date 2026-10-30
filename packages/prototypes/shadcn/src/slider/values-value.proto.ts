import { definePrototype, tw } from '@proto.ui/core';
import {
  asSliderValuesValue,
  type SliderValuesPartProps,
  type SliderValuesPartExposes,
} from '@proto.ui/prototypes-base/slider';

export default definePrototype<SliderValuesPartProps, SliderValuesPartExposes>({
  name: 'shadcn-slider-values-value',
  setup(def) {
    const inherited = asSliderValuesValue();
    // Preserve Base's sorted-display text, not the caller's Value slot.
    def.feedback.style.use(tw('text-sm tabular-nums text-muted-foreground'));
    return inherited.render;
  },
});
