import type { SliderFieldThumbExposes } from './types';
import type { State } from '@proto.ui/core';
import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { setupSliderPart } from './part-setup';
import type { SliderPartProps } from './types';
const setup = (def: DefHandle<SliderPartProps>) => setupSliderPart(def, 'thumb', true);
export const asSliderFieldThumb = defineAsHook<
  SliderPartProps,
  SliderFieldThumbExposes,
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
    asHooks: { 'as-field-control': import('../field').FieldControlBindingHandles };
  }
>({ name: 'as-slider-field-thumb', setup });
export default definePrototype<SliderPartProps, SliderFieldThumbExposes>({
  name: 'base-slider-field-thumb',
  setup,
});
