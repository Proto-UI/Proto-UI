import { definePrototype } from '@proto.ui/core';
import {
  asFieldTextControl,
  type FieldControlProps,
  type FieldControlExposes,
} from '@proto.ui/prototypes-base/field';
import { setupInputVisual } from '../input/visual';
export default definePrototype<FieldControlProps, FieldControlExposes>({
  name: 'bootstrap-2-3-2-field-control',
  modules: asFieldTextControl.modules,
  setup(def) {
    const inherited = asFieldTextControl();
    const state = inherited.stateHandles!;
    const binding = inherited.getAsHookHandle?.('as-field-control');
    if (!binding) throw new Error('[field-control] Base Field binding handle required.');
    setupInputVisual(def, state, binding.state.invalid);
    return inherited.render;
  },
});
