import type {
  NumberFieldPartProps,
  NumberFieldStepExposes,
} from '@proto.ui/prototypes-base/number-field';
import { definePrototype } from '@proto.ui/core';
import { asNumberFieldIncrement } from '@proto.ui/prototypes-base/number-field';
import { setupNumberFieldStepVisual } from './step-visual';

export default definePrototype<NumberFieldPartProps, NumberFieldStepExposes>({
  name: 'liquid-glass-number-field-increment',
  modules: asNumberFieldIncrement.modules,
  setup(def) {
    const inherited = asNumberFieldIncrement();
    setupNumberFieldStepVisual(def, inherited.stateHandles!);
    return inherited.render;
  },
});
