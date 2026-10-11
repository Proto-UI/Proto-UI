import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { setupSliderValuesPart } from './values-part-setup';
import type {
  SliderValuesPartProps,
  SliderValuesPartExposes,
  SliderValuesPartStates,
} from './values-types';
const setup = (def: DefHandle<SliderValuesPartProps>) => setupSliderValuesPart(def, 'track');
export const asSliderValuesTrack = defineAsHook<
  SliderValuesPartProps,
  SliderValuesPartExposes,
  { state: SliderValuesPartStates }
>({ name: 'as-slider-values-track', setup });
export default definePrototype<SliderValuesPartProps, SliderValuesPartExposes>({
  name: 'base-slider-values-track',
  setup,
});
