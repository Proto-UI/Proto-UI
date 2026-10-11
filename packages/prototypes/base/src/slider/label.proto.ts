import type { SliderPartExposes } from './types';
import type { State } from '@proto.ui/core';
import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { setupSliderPart } from './part-setup';
import type { SliderPartProps } from './types';
const setup = (def: DefHandle<SliderPartProps>) => setupSliderPart(def, 'label');
export const asSliderLabel = defineAsHook<
  SliderPartProps,
  SliderPartExposes,
  {
    state: {
      value: State<number>;
      percentage: State<number>;
      disabled: State<boolean>;
      readOnly: State<boolean>;
      orientation: State<string>;
      direction: State<string>;
    };
  }
>({ name: 'as-slider-label', setup });
export default definePrototype<SliderPartProps, SliderPartExposes>({
  name: 'base-slider-label',
  setup,
});
