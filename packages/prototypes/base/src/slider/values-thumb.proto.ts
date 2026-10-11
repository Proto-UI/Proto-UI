import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { setupSliderValuesPart } from './values-part-setup';
import type {
  SliderValuesPartProps,
  SliderValuesThumbExposes,
  SliderValuesThumbAsHookContract,
} from './values-types';
const setup = (def: DefHandle<SliderValuesPartProps>) => setupSliderValuesPart(def, 'thumb');
export const asSliderValuesThumb = defineAsHook<
  SliderValuesPartProps,
  SliderValuesThumbExposes,
  SliderValuesThumbAsHookContract
>({ name: 'as-slider-values-thumb', setup });
export default definePrototype<SliderValuesPartProps, SliderValuesThumbExposes>({
  name: 'base-slider-values-thumb',
  setup,
});
