import { createAnatomyFamily, createContextKey } from '@proto.ui/core';
export const FIELDSET_CONTEXT = createContextKey<{ disabled: boolean }>('base-fieldset');
export const FIELDSET_FAMILY = createAnatomyFamily('base-fieldset', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    legend: { cardinality: { min: 0, max: 1 } },
    description: { cardinality: { min: 0, max: 1 } },
  },
  relations: ['legend', 'description'].map((child) => ({
    kind: 'contains' as const,
    parent: 'root',
    child,
  })),
});
