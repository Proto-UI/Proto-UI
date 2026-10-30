import { createContextKey } from '@proto.ui/core';
import type { ShadcnStyleId } from '../style-scope';

// Private presentation facts from the actual Item containing each Indicator.
// No value, activation, focus or disabled ownership travels through this key.
export const RADIO_GROUP_VISUAL = createContextKey<{ style: ShadcnStyleId }>(
  'shadcn-radio-group-item-visual'
);
