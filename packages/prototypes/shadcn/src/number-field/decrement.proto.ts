import type { NumberFieldStepExposes } from '@proto.ui/prototypes-base/number-field';
import { definePrototype } from '@proto.ui/core';
import { asNumberFieldDecrement } from '@proto.ui/prototypes-base/number-field';
import type { ShadcnNumberFieldPartProps } from './types';
import { setupNumberFieldStepVisual } from './step-visual';

export default definePrototype<ShadcnNumberFieldPartProps, NumberFieldStepExposes>({
  name: 'shadcn-number-field-decrement',
  modules: asNumberFieldDecrement.modules,
  setup(def) {
    const inherited = asNumberFieldDecrement();
    setupNumberFieldStepVisual(def, inherited.stateHandles!);
    return inherited.render;
  },
});
