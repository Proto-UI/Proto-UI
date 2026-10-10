import type { State } from '@proto.ui/core';
import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { setupSliderPart } from './part-setup';
import type { SliderPartProps } from './types';
const setup = (def: DefHandle<SliderPartProps>) => setupSliderPart(def, 'indicator');
export const asSliderIndicator = defineAsHook<
  SliderPartProps,
  Record<string, unknown>,
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
>({ name: 'as-slider-indicator', setup });
export default definePrototype({ name: 'base-slider-indicator', setup });
