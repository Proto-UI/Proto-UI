import { definePrototype, tw } from '@proto.ui/core';
import { asSliderLabel } from '@proto.ui/prototypes-base/slider';
export default definePrototype({
  name: 'bootstrap-2-3-2-slider-label',
  setup(def) {
    const inherited = asSliderLabel();
    def.feedback.style.use(tw('block w-full text-sm font-medium'));
    return inherited.render;
  },
});
