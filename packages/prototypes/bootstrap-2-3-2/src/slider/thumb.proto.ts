import type { SliderThumbExposes } from '@proto.ui/prototypes-base/slider';
import type { SliderPartProps } from '@proto.ui/prototypes-base/slider';
import { definePrototype } from '@proto.ui/core';
import { asSliderThumb } from '@proto.ui/prototypes-base/slider';
import { setupSliderThumbVisual } from './thumb-visual';
export default definePrototype<SliderPartProps, SliderThumbExposes>({
  name: 'bootstrap-2-3-2-slider-thumb',
  setup(def) {
    const inherited = asSliderThumb();
    setupSliderThumbVisual(def, inherited.stateHandles!);
    return inherited.render;
  },
});
