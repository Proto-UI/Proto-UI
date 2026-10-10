import { definePrototype, tw } from '@proto.ui/core';
import { asSliderValue } from '@proto.ui/prototypes-base/slider';
export default definePrototype({
  name: 'brutalist-slider-value',
  setup(def) {
    const inherited = asSliderValue();
    def.feedback.style.use(tw('text-sm tabular-nums text-muted-foreground'));
    return inherited.render;
  },
});
