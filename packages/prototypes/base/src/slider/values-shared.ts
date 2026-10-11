import { createAnatomyFamily, createContextKey, type RunHandle } from '@proto.ui/core';
export const SLIDER_VALUES_FAMILY = createAnatomyFamily('base-slider-values', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    track: { cardinality: { min: 0, max: 1 } },
    thumb: { cardinality: { min: 0, max: '*' } },
    indicator: { cardinality: { min: 0, max: '*' } },
    label: { cardinality: { min: 0, max: 1 } },
    value: { cardinality: { min: 0, max: 1 } },
  },
  relations: ['track', 'thumb', 'indicator', 'label', 'value'].map((child) => ({
    kind: 'contains' as const,
    parent: 'root',
    child,
  })),
});
export type SliderValuesContext = {
  values: number[];
  ready: boolean;
  mappingReady: boolean;
  min: number;
  max: number;
  step: number;
  largeStep: number;
  minStepsBetweenValues: number;
  disabled: boolean;
  readOnly: boolean;
  orientation: 'horizontal' | 'vertical';
  direction: 'ltr' | 'rtl';
  label: string;
  phase: string;
};
export const SLIDER_VALUES_CONTEXT = createContextKey<SliderValuesContext>('base-slider-values');
export function sliderValuesMethod(run: RunHandle<any>, key: string, ...args: unknown[]) {
  const method = run.anatomy.partsOf(SLIDER_VALUES_FAMILY, 'root')[0]?.getExpose(key);
  return typeof method === 'function' ? method(...args) : false;
}
