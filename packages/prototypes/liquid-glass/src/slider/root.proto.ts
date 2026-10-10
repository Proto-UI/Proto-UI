import { definePrototype, tw } from '@proto.ui/core';
import { asSliderRoot } from '@proto.ui/prototypes-base/slider';
export default definePrototype({
  name: 'liquid-glass-slider-root',
  setup(def) {
    const inherited = asSliderRoot();
    def.feedback.style.use(tw('flex w-full min-w-0 flex-wrap items-center gap-3 text-foreground'));
    return inherited.render;
  },
});
