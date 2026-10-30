import type { NumberFieldStepExposes } from '@proto.ui/prototypes-base/number-field';
import { definePrototype } from '@proto.ui/core';
import { asNumberFieldIncrement } from '@proto.ui/prototypes-base/number-field';
import type { ShadcnNumberFieldPartProps } from './types';
import { setupNumberFieldStepVisual } from './step-visual';

export default definePrototype<ShadcnNumberFieldPartProps, NumberFieldStepExposes>({
  name: 'shadcn-number-field-increment',
  modules: asNumberFieldIncrement.modules,
  setup(def) {
    const inherited = asNumberFieldIncrement();
    setupNumberFieldStepVisual(def, inherited.stateHandles!);
    return inherited.render;
  },
});
