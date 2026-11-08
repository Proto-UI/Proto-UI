import { definePrototype, tw } from '@proto.ui/core';
import { asAsyncRegionRoot } from '@proto.ui/prototypes-base/async-region';
import type { BrutalistAsyncRegionRootExposes, BrutalistAsyncRegionRootProps } from './types';

// Semantic-only Proto extension; there is no upstream Neo async-region component
// to pin. Base owns the governed busy fact, its aria-busy projection, and the
// preservation of authored descendants, so this layer adds only the restrained
// family ink and bounded width ordinary content chrome
// (P-BRUTALIST-ASYNC-REGION-VISUAL-GRAMMAR). Busy is not a loading widget: no
// spinner, skeleton, progress, toast, timer, or second state machine is added.
const ROOT_SURFACE_TOKENS = 'min-w-0 max-w-full text-foreground';

const asyncRegionRoot = definePrototype<
  BrutalistAsyncRegionRootProps,
  BrutalistAsyncRegionRootExposes
>({
  name: 'brutalist-async-region-root',
  modules: asAsyncRegionRoot.modules,
  setup(def) {
    // P-BRUTALIST-ASYNC-REGION-BASE-INHERITANCE: one inherited semantic owner;
    // no focus, event, command, announcement channel, accessible-name override,
    // or second busy state machine is added here.
    const behavior = asAsyncRegionRoot();
    def.feedback.style.use(tw(ROOT_SURFACE_TOKENS));
    return behavior.render;
  },
});

export default asyncRegionRoot;
