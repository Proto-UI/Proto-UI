import { definePrototype } from '@proto.ui/core';
import {
  asInputRoot,
  type InputRootProps,
  type InputRootExposes,
} from '@proto.ui/prototypes-base/input';
import { setupInputVisual } from './visual';

// Independently expressed Bootstrap 2.3.2 design-language projection.
// Base retains all semantics; source attribution: ../../THIRD_PARTY_NOTICES.md.
export default definePrototype<InputRootProps, InputRootExposes>({
  name: 'bootstrap-2-3-2-input-root',
  modules: asInputRoot.modules,
  setup(def) {
    const inherited = asInputRoot();
    if (!inherited.stateHandles)
      throw new Error('[bootstrap-2-3-2-input-root] Base state handles required.');
    setupInputVisual(def, inherited.stateHandles);
    return inherited.render;
  },
});
