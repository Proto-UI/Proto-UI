import { definePrototype } from '@proto.ui/core';
import {
  asLiveRegionRoot,
  type LiveRegionRootProps,
  type LiveRegionRootExposes,
} from '@proto.ui/prototypes-base/live-region';

// Semantic-only extension, not Bootstrap's visual Alert component. The authored
// slot remains the announcement payload; Base alone owns role/live/atomic.
export const liveRegionRoot = definePrototype<LiveRegionRootProps, LiveRegionRootExposes>({
  name: 'bootstrap-2-3-2-live-region-root',
  modules: asLiveRegionRoot.modules,
  setup() {
    return asLiveRegionRoot().render;
  },
});

export default liveRegionRoot;
