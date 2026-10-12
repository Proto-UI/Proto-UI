import { createContextKey } from '@proto.ui/core';

/** Private scalar projection. Never exported through the Drawer package entrypoint. */
export const DRAWER_PRESENTATION_CONTEXT = createContextKey<{
  rootId: string;
  side: string;
}>('base-drawer-presentation');
