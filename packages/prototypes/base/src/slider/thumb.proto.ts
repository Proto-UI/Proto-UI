import type { SliderThumbExposes } from './types';
import type { State } from '@proto.ui/core';
import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { setupSliderPart } from './part-setup';
import type { SliderPartProps } from './types';
const setup = (def: DefHandle<SliderPartProps>) => setupSliderPart(def, 'thumb');
export const asSliderThumb = defineAsHook<
  SliderPartProps,
  SliderThumbExposes,
  {
    state: {
      value: State<number>;
      percentage: State<number>;
      disabled: State<boolean>;
      readOnly: State<boolean>;
      orientation: State<string>;
      direction: State<string>;
      focusVisible: State<boolean>;
      hovered: State<boolean>;
      pressed: State<boolean>;
    };
  }
>({ name: 'as-slider-thumb', setup });
export default definePrototype<SliderPartProps, SliderThumbExposes>({
  name: 'base-slider-thumb',
  setup,
});
