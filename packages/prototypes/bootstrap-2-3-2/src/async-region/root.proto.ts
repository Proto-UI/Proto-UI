import { definePrototype } from '@proto.ui/core';
import {
  asAsyncRegionRoot,
  type AsyncRegionRootProps,
  type AsyncRegionRootExposes,
} from '@proto.ui/prototypes-base/async-region';

// Semantic-only extension: Bootstrap 2.3.2 has no Async Region widget.
// Busy must not replace, hide or restyle the caller's retained content.
export const asyncRegionRoot = definePrototype<AsyncRegionRootProps, AsyncRegionRootExposes>({
  name: 'bootstrap-2-3-2-async-region-root',
  modules: asAsyncRegionRoot.modules,
  setup() {
    return asAsyncRegionRoot().render;
  },
});

export default asyncRegionRoot;
