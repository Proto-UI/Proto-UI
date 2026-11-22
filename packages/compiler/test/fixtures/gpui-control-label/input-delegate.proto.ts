import { definePrototype } from '@proto.ui/core';
import { asInputRoot } from '../../../../prototypes/base/src/input/root.proto';

// The official editor renders an empty template while TextControl supplies the
// native editing surface. Borrowing its render is ordinary authored composition.
export default definePrototype({
  name: 'official-input-delegated-render',
  modules: asInputRoot.modules,
  setup() {
    const inherited = asInputRoot();
    return inherited.render;
  },
});
