import type {
  NumberFieldInputExposes,
  NumberFieldPartProps,
} from '@proto.ui/prototypes-base/number-field';
import { definePrototype, tw } from '@proto.ui/core';
import { asNumberFieldInput } from '@proto.ui/prototypes-base/number-field';
import { setupInputVisual } from '../input/visual';
export default definePrototype<NumberFieldPartProps, NumberFieldInputExposes>({
  name: 'bootstrap-2-3-2-number-field-input',
  modules: asNumberFieldInput.modules,
  setup(def) {
    const inherited = asNumberFieldInput();
    setupInputVisual(def, inherited.stateHandles!);
    def.feedback.style.use(tw('mb-0 w-auto min-w-0 flex-1 tabular-nums'));
    return inherited.render;
  },
});
