import { definePrototype, tw } from '@proto.ui/core';
import {
  asAsyncRegionRoot,
  type AsyncRegionRootExposes,
  type AsyncRegionRootProps,
} from '@proto.ui/prototypes-base/async-region';

/** Proto extension: Shadcn has no Async Region recipe. Busy is not loading UI. */
export const asyncRegionRoot = definePrototype<AsyncRegionRootProps, AsyncRegionRootExposes>({
  name: 'shadcn-async-region-root',
  modules: asAsyncRegionRoot.modules,
  setup(def) {
    const behavior = asAsyncRegionRoot();
    // P-SHADCN-ASYNC-REGION-VISUAL: neutral readable foreground and block layout bounds only.
    def.feedback.style.use(tw('block min-w-0 max-w-full text-foreground'));
    return behavior.render;
  },
});

export default asyncRegionRoot;
