import { createAnatomyFamily, createContextKey } from '@proto.ui/core';

export type TabsOrientation = 'horizontal' | 'vertical';
export type TabsActivationMode = 'automatic' | 'manual';

export type TabsContextValue = {
  // P-BASE-TABS-CONTEXT-VALUE, P-BASE-TABS-ACTIVE-VALUE
  value: string;
  activeValue: string;
  orientation: TabsOrientation;
  activationMode: TabsActivationMode;
  controlled: boolean;
  requestedValue: string;
  requestVersion: number;
  validationVersion: number;
};

// P-BASE-TABS-ANATOMY-FAMILY, P-BASE-TABS-FAMILY-ROLES
// P-BASE-TABS-ROOT-CARDINALITY, P-BASE-TABS-LIST-CARDINALITY
// P-BASE-TABS-TRIGGER-CARDINALITY, P-BASE-TABS-CONTENT-CARDINALITY
// P-BASE-TABS-INDICATOR-CARDINALITY
// P-BASE-TABS-ROOT-CONTAINS-LIST, P-BASE-TABS-LIST-CONTAINS-TRIGGER
// P-BASE-TABS-ROOT-CONTAINS-CONTENT, P-BASE-TABS-ROOT-CONTAINS-INDICATOR
export const TABS_FAMILY = createAnatomyFamily('base-tabs', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    list: { cardinality: { min: 0, max: 1 } },
    trigger: { cardinality: { min: 0, max: 100 } },
    content: { cardinality: { min: 0, max: 100 } },
    indicator: { cardinality: { min: 0, max: '*' } },
  },
  relations: [
    { kind: 'contains', parent: 'root', child: 'list' },
    { kind: 'contains', parent: 'list', child: 'trigger' },
    { kind: 'contains', parent: 'root', child: 'content' },
    { kind: 'contains', parent: 'root', child: 'indicator' },
  ],
});
// P-BASE-TABS-CONTEXT-KEY
export const TABS_CONTEXT = createContextKey<TabsContextValue>('base-tabs');
