import { createAnatomyFamily } from '@proto.ui/core';
import type { ContextKey } from '@proto.ui/types';

export type RadioGroupContextValue = {
  value: string;
  disabled: boolean;
  controlled: boolean;
  selectItem: (itemValue: string) => void;
};

export const RADIO_GROUP_FAMILY = createAnatomyFamily('base-radio-group', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    item: { cardinality: { min: 0, max: 100 } },
  },
  relations: [{ kind: 'contains', parent: 'root', child: 'item' }],
});

export const RADIO_GROUP_CONTEXT = {
  __brand: 'ContextKey',
  debugName: 'base-radio-group',
} as ContextKey<RadioGroupContextValue>;
