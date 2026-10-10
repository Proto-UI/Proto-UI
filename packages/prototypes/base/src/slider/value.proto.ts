import type { SliderPartExposes } from './types';
import type { State } from '@proto.ui/core';
import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { setupSliderPart } from './part-setup';
import type { SliderPartProps } from './types';
const setup = (def: DefHandle<SliderPartProps>) => setupSliderPart(def, 'value');
export const asSliderValue = defineAsHook<
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
>({ name: 'as-slider-value', setup });
export default definePrototype<SliderPartProps, SliderPartExposes>({
  name: 'base-slider-value',
  setup,
});
