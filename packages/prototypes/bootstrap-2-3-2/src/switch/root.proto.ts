import { definePrototype } from '@proto.ui/core';
import {
  asSwitchRoot,
  type SwitchRootProps,
  type SwitchRootExposes,
} from '@proto.ui/prototypes-base/switch';
import { setupSwitchRootVisual } from './root-visual';

// Independently expressed Bootstrap 2.3.2 design-language projection.
// Base retains all semantics; source attribution: ../../THIRD_PARTY_NOTICES.md.
// Extension: core Bootstrap 2.3.2 does not supply a Switch component.
export default definePrototype<SwitchRootProps, SwitchRootExposes>({
  name: 'bootstrap-2-3-2-switch-root',
  setup(def) {
    const state = asSwitchRoot().stateHandles;
    if (!state) throw new Error('[bootstrap-2-3-2-switch-root] Base state handles required.');
    setupSwitchRootVisual(def, state);
  },
});
