// Neutral content-region projection: family ink only, no optical material owner.
import { definePrototype, tw } from '@proto.ui/core';
import {
  asLiveRegionRoot,
  type LiveRegionRootProps,
  type LiveRegionRootExposes,
} from '@proto.ui/prototypes-base/live-region';

export default definePrototype<LiveRegionRootProps, LiveRegionRootExposes>({
  name: 'liquid-glass-live-region-root',
  modules: asLiveRegionRoot.modules,
  setup(def) {
    // Base owns role/aria-live/aria-atomic projection and announcement payload
    // semantics. No focus, event, command, selection, accessible-name override,
    // or material channel is added here (P-BASE-LIVE-REGION-* boundary).
    const behavior = asLiveRegionRoot();
    // Restrained ordinary content treatment: bounded neutral ink and width only.
    def.feedback.style.use(tw('min-w-0 max-w-full text-foreground'));
    return behavior.render;
  },
});
