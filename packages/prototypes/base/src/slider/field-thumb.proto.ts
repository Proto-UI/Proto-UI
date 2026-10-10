import type { State } from '@proto.ui/core';
import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { setupSliderPart } from './part-setup';
import type { SliderPartProps } from './types';
const setup = (def: DefHandle<SliderPartProps>) => setupSliderPart(def, 'thumb', true);
export const asSliderFieldThumb = defineAsHook<
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
      focusVisible: State<boolean>;
    };
  }
>({ name: 'as-slider-field-thumb', setup });
export default definePrototype({ name: 'base-slider-field-thumb', setup });
