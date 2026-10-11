import { createAnatomyFamily, createContextKey } from '@proto.ui/core';
export const METER_FAMILY = createAnatomyFamily('base-meter', {
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
export type MeterContext = {
  value: number;
  percentage: number;
  indeterminate: boolean;
  status: string;
  valueText: string;
};
export const METER_CONTEXT = createContextKey<MeterContext>('base-meter');
