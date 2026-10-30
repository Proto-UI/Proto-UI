import type { NumberFieldStepExposes } from '@proto.ui/prototypes-base/number-field';
import type { NumberFieldPartProps } from '@proto.ui/prototypes-base/number-field';
import { definePrototype } from '@proto.ui/core';
import { asNumberFieldDecrement } from '@proto.ui/prototypes-base/number-field';
import { setupButtonVisual } from '../button/visual';
export default definePrototype<NumberFieldPartProps, NumberFieldStepExposes>({
  name: 'bootstrap-2-3-2-number-field-decrement',
  setup(def) {
    const inherited = asNumberFieldDecrement();
    setupButtonVisual(def, inherited.stateHandles!);
    return inherited.render;
  },
});
