import { definePrototype } from '@proto.ui/core';
import {
  asAsyncRegionRoot,
  type AsyncRegionRootExposes,
  type AsyncRegionRootProps,
} from '@proto.ui/prototypes-base/async-region';

/** Proto extension: Shadcn has no Async Region recipe. Busy is not loading UI. */
export const asyncRegionRoot = definePrototype<AsyncRegionRootProps, AsyncRegionRootExposes>({
  name: 'shadcn-async-region-root',
  modules: asAsyncRegionRoot.modules,
  setup() {
    return asAsyncRegionRoot().render;
  },
});

export default asyncRegionRoot;
