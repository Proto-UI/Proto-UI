import { createContextKey } from '@proto.ui/core';
import type { BrutalistSwitchSize } from './types';

export const BRUTALIST_SWITCH_VISUAL = createContextKey<{
  size: BrutalistSwitchSize;
}>('brutalist-switch-visual');

export function normalizeBrutalistSwitchSize(value: unknown): BrutalistSwitchSize {
  return value === 'sm' ? 'sm' : 'default';
}
