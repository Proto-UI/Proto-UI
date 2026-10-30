import { createContextKey } from '@proto.ui/core';

/** Presentation-only transport of the effective axis already owned by Base. */
export const TOGGLE_GROUP_VISUAL_AXIS = createContextKey<{ orientation: string }>(
  'bootstrap-2-3-2-toggle-group-visual-axis'
);
