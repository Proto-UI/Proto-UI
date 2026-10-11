import { createAnatomyFamily, createContextKey } from '@proto.ui/core';
export const PROGRESS_FAMILY = createAnatomyFamily('base-progress', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    label: { cardinality: { min: 0, max: 1 } },
    track: { cardinality: { min: 0, max: 1 } },
    indicator: { cardinality: { min: 0, max: 1 } },
    value: { cardinality: { min: 0, max: 1 } },
  },
  relations: ['label', 'track', 'indicator', 'value'].map((child) => ({
    kind: 'contains' as const,
    parent: 'root',
    child,
  })),
});
export type ProgressContext = {
  value: number;
  percentage: number;
  indeterminate: boolean;
  status: string;
  valueText: string;
};
export const PROGRESS_CONTEXT = createContextKey<ProgressContext>('base-progress');
