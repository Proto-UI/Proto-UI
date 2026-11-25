import type {
  NumberFieldPartProps,
  NumberFieldStepExposes,
} from '@proto.ui/prototypes-base/number-field';
import { definePrototype } from '@proto.ui/core';
import { asNumberFieldDecrement } from '@proto.ui/prototypes-base/number-field';
import { setupNumberFieldStepVisual } from './step-visual';

export default definePrototype<NumberFieldPartProps, NumberFieldStepExposes>({
  name: 'bootstrap-2-3-2-number-field-decrement',
  modules: asNumberFieldDecrement.modules,
  setup(def) {
    const inherited = asNumberFieldDecrement();
    setupNumberFieldStepVisual(def, inherited.stateHandles!);
    return inherited.render;
  },
});
