// Neutral content-region projection: family ink only, no optical material owner.
import { definePrototype, tw } from '@proto.ui/core';
import {
  asAsyncRegionRoot,
  type AsyncRegionRootProps,
  type AsyncRegionRootExposes,
} from '@proto.ui/prototypes-base/async-region';

export default definePrototype<AsyncRegionRootProps, AsyncRegionRootExposes>({
  name: 'liquid-glass-async-region-root',
  modules: asAsyncRegionRoot.modules,
  setup(def) {
    // Base owns the governed busy projection, the single exposes state handle,
    // and authored-content/focus preservation. No announcement, focus, input,
    // or material channel is added here (P-BASE-ASYNC-REGION-* boundary).
    const behavior = asAsyncRegionRoot();
    // Restrained ordinary content treatment: block layout bounds and neutral ink only, no glass material.
    def.feedback.style.use(tw('block min-w-0 max-w-full text-foreground'));
    return behavior.render;
  },
});
