import { definePrototype, tw } from '@proto.ui/core';
import { asLiveRegionRoot } from '@proto.ui/prototypes-base/live-region';
import type { BrutalistLiveRegionRootExposes, BrutalistLiveRegionRootProps } from './types';

// Semantic-only Proto extension; there is no upstream Neo live-region component
// to pin. Base owns role/aria-live/aria-atomic projection and the authored slot
// stays the announcement payload, so this layer adds only the restrained
// family ink and bounded width ordinary content chrome (P-BRUTALIST-LIVE-REGION-VISUAL-GRAMMAR).
const ROOT_SURFACE_TOKENS = 'min-w-0 max-w-full text-foreground';

const liveRegionRoot = definePrototype<
  BrutalistLiveRegionRootProps,
  BrutalistLiveRegionRootExposes
>({
  name: 'brutalist-live-region-root',
  modules: asLiveRegionRoot.modules,
  setup(def) {
    // P-BRUTALIST-LIVE-REGION-BASE-INHERITANCE: one inherited semantic owner;
    // no focus, event, command, selection, accessible-name override, or
    // notification channel is added here.
    const behavior = asLiveRegionRoot();
    def.feedback.style.use(tw(ROOT_SURFACE_TOKENS));
    return behavior.render;
  },
});

export default liveRegionRoot;
