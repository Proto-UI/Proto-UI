import { createContextKey } from '@proto.ui/core';
import type { ShadcnSwitchSize } from './types';

// P-SHADCN-SWITCH-VISUAL-SIZE-OWNER: notification, never owner authority.
export const SWITCH_VISUAL = createContextKey<{
  size: ShadcnSwitchSize;
  style: 'new-york-v4' | 'rhea';
}>('shadcn-switch-visual');

export function normalizeSwitchSize(value: unknown): ShadcnSwitchSize {
  return value === 'sm' ? 'sm' : 'default';
}
