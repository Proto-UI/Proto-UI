import { definePrototype } from '@proto.ui/core';
import {
  asFieldSwitch,
  type FieldSwitchProps,
  type FieldSwitchExposes,
} from '@proto.ui/prototypes-base/field';
import { setupSwitchRootVisual } from '../switch/root-visual';

// Semantic Field composition: same Base switch owner and same family paint setup.
// The optional Field binding owns invalid/pending, disabled/readOnly policy and
// label pairing; this prototype adds no second activation or validation owner.
export default definePrototype<FieldSwitchProps, FieldSwitchExposes>({
  name: 'bootstrap-2-3-2-field-switch',
  modules: asFieldSwitch.modules,
  setup(def) {
    const control = asFieldSwitch();
    const binding = control.getAsHookHandle?.('as-optional-field-control');
    if (!control.stateHandles || !binding) {
      throw new Error('[bootstrap-2-3-2-field-switch] Missing Base/Field facts.');
    }
    setupSwitchRootVisual(def, control.stateHandles, binding.state.invalid);
  },
});
