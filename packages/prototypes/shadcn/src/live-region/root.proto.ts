import { definePrototype, tw } from '@proto.ui/core';
import {
  asLiveRegionRoot,
  type LiveRegionRootExposes,
  type LiveRegionRootProps,
} from '@proto.ui/prototypes-base/live-region';

const ROOT_SURFACE_TOKENS = 'min-w-0 max-w-full text-foreground';

/** Proto extension, not an upstream Shadcn component or a notification owner. */
export const liveRegionRoot = definePrototype<LiveRegionRootProps, LiveRegionRootExposes>({
  name: 'shadcn-live-region-root',
  modules: asLiveRegionRoot.modules,
  setup(def) {
    const behavior = asLiveRegionRoot();
    def.feedback.style.use(tw(ROOT_SURFACE_TOKENS));
    return behavior.render;
  },
});

export default liveRegionRoot;
