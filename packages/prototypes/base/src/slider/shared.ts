import { createAnatomyFamily, createContextKey, type RunHandle } from '@proto.ui/core';
export const SLIDER_FAMILY = createAnatomyFamily('base-slider', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    track: { cardinality: { min: 1, max: 1 } },
    thumb: { cardinality: { min: 1, max: 1 } },
    indicator: { cardinality: { min: 0, max: 1 } },
    label: { cardinality: { min: 0, max: 1 } },
    value: { cardinality: { min: 0, max: 1 } },
  },
  relations: ['track', 'thumb', 'indicator', 'label', 'value'].map((child) => ({
    kind: 'contains' as const,
    parent: 'root',
    child,
  })),
});
export type SliderContext = {
  value: number;
  interactionPhase: 'idle' | 'active' | 'commit' | 'cancel';
  min: number;
  max: number;
  step: number;
  percentage: number;
  disabled: boolean;
  controlDisabled: boolean;
  controlReadOnly: boolean;
  readOnly: boolean;
  orientation: 'horizontal' | 'vertical';
  direction: 'ltr' | 'rtl';
  valueText: string;
  label: string;
};
export const SLIDER_CONTEXT = createContextKey<SliderContext>('base-slider');
export function sliderMethod(run: RunHandle<any>, key: string, ...args: unknown[]) {
  const fn = run.anatomy.partsOf(SLIDER_FAMILY, 'root')[0]?.getExpose(key);
  return typeof fn === 'function' ? fn(...args) : false;
}
