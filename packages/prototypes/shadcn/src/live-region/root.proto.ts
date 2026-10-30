import { definePrototype } from '@proto.ui/core';
import {
  asLiveRegionRoot,
  type LiveRegionRootExposes,
  type LiveRegionRootProps,
} from '@proto.ui/prototypes-base/live-region';

/** Proto extension, not an upstream Shadcn component or a notification owner. */
export const liveRegionRoot = definePrototype<LiveRegionRootProps, LiveRegionRootExposes>({
  name: 'shadcn-live-region-root',
  modules: asLiveRegionRoot.modules,
  setup() {
    return asLiveRegionRoot().render;
  },
});

export default liveRegionRoot;
