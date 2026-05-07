import { createAnatomyFamily } from '@proto.ui/core';
import type { ContextKey } from '@proto.ui/types';

export type CheckboxContextValue = {
  checked: boolean;
  indeterminate: boolean;
  disabled: boolean;
};

export const CHECKBOX_FAMILY = createAnatomyFamily('base-checkbox', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    indicator: { cardinality: { min: 1, max: 100 } },
  },
  relations: [{ kind: 'contains', parent: 'root', child: 'indicator' }],
});

export const CHECKBOX_CONTEXT = {
  __brand: 'ContextKey',
  debugName: 'base-checkbox',
} as ContextKey<CheckboxContextValue>;
