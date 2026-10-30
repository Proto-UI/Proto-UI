import { createContextKey } from '@proto.ui/core';

/** Read-only transport of Base's axis for joined-edge presentation only. */
export const TOGGLE_GROUP_VISUAL_AXIS = createContextKey<{ orientation: string }>(
  'shadcn-toggle-group-visual-axis'
);
