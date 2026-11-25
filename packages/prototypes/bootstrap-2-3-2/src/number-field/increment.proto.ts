import type {
  NumberFieldPartProps,
  NumberFieldStepExposes,
} from '@proto.ui/prototypes-base/number-field';
import { definePrototype } from '@proto.ui/core';
import { asNumberFieldIncrement } from '@proto.ui/prototypes-base/number-field';
import { setupNumberFieldStepVisual } from './step-visual';
export default definePrototype<NumberFieldPartProps, NumberFieldStepExposes>({
  name: 'bootstrap-2-3-2-number-field-increment',
  modules: asNumberFieldIncrement.modules,
  setup(def) {
    const inherited = asNumberFieldIncrement();
    const state = inherited.stateHandles!;
    setupNumberFieldStepVisual(def, state);
    return inherited.render;
  },
});
