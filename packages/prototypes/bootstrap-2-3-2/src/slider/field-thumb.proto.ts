import type { SliderFieldThumbExposes } from '@proto.ui/prototypes-base/slider';
import type { SliderPartProps } from '@proto.ui/prototypes-base/slider';
import { definePrototype } from '@proto.ui/core';
import { asSliderFieldThumb } from '@proto.ui/prototypes-base/slider';
import { setupSliderThumbVisual } from './thumb-visual';
export default definePrototype<SliderPartProps, SliderFieldThumbExposes>({
  name: 'bootstrap-2-3-2-slider-field-thumb',
  setup(def) {
    const inherited = asSliderFieldThumb();
    const binding = inherited.getAsHookHandle!('as-field-control');
    if (!binding)
      throw new Error('[bootstrap-2-3-2-slider-field-thumb] Base Field binding required.');
    setupSliderThumbVisual(def, inherited.stateHandles!, binding.state.invalid);
    return inherited.render;
  },
});
