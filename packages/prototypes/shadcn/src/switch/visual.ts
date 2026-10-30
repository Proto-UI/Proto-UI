import { createContextKey } from '@proto.ui/core';
import type { ShadcnStyleId } from '../style-scope';
import type { ShadcnSwitchSize } from './types';

// P-SHADCN-SWITCH-VISUAL-SIZE-OWNER: notification, never owner authority.
// The resolved style is the actual Switch Root's paint selection; every
// supported profile reaches the Thumb through this same channel.
export const SWITCH_VISUAL = createContextKey<{
  size: ShadcnSwitchSize;
  style: ShadcnStyleId;
}>('shadcn-switch-visual');

export function normalizeSwitchSize(value: unknown): ShadcnSwitchSize {
  return value === 'sm' ? 'sm' : 'default';
}
