import { createAnatomyFamily } from '@proto.ui/core';
import type { ContextKey } from '@proto.ui/types';

export type SliderContextValue = {
  value: number;
  controlled: boolean;
  disabled: boolean;
  min: number;
  max: number;
  step: number;
  orientation: 'horizontal' | 'vertical';
};

export const SLIDER_FAMILY = createAnatomyFamily('base-slider', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
  },
  relations: [],
});

export const SLIDER_CONTEXT = {
  __brand: 'ContextKey',
  debugName: 'base-slider',
} as ContextKey<SliderContextValue>;
