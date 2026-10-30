import { definePrototype } from '@proto.ui/core';
import { asToggle, type ToggleProps, type ToggleExposes } from '@proto.ui/prototypes-base/toggle';
import { setupButtonVisual } from '../button/visual';

// Design-language extension: Base Toggle owns active state; Bootstrap 2.3.2
// stateful .btn is only the visual reference, not a copied jQuery behavior.
// Source attribution: ../../THIRD_PARTY_NOTICES.md.
export default definePrototype<ToggleProps, ToggleExposes>({
  name: 'bootstrap-2-3-2-toggle',
  setup(def) {
    const inherited = asToggle();
    const state = inherited.stateHandles;
    if (!state) throw new Error('[bootstrap-2-3-2-toggle] Base state handles required.');
    setupButtonVisual(def, state);
    return inherited.render;
  },
});
