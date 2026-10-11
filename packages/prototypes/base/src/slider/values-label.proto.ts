import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { setupSliderValuesPart } from './values-part-setup';
import type {
  SliderValuesPartProps,
  SliderValuesPartExposes,
  SliderValuesPartStates,
} from './values-types';
const setup = (def: DefHandle<SliderValuesPartProps>) => setupSliderValuesPart(def, 'label');
export const asSliderValuesLabel = defineAsHook<
  SliderValuesPartProps,
  SliderValuesPartExposes,
  { state: SliderValuesPartStates }
>({ name: 'as-slider-values-label', setup });
export default definePrototype<SliderValuesPartProps, SliderValuesPartExposes>({
  name: 'base-slider-values-label',
  setup,
});
