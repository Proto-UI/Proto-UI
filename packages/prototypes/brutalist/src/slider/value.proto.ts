import type { SliderPartProps } from '@proto.ui/prototypes-base/slider';
import { definePrototype, tw } from '@proto.ui/core';
import { asSliderValue } from '@proto.ui/prototypes-base/slider';
export default definePrototype<SliderPartProps, Record<string, unknown>>({
  name: 'brutalist-slider-value',
  setup(def) {
    const inherited = asSliderValue();
    def.feedback.style.use(tw('text-sm tabular-nums text-muted-foreground'));
    return inherited.render;
  },
});
