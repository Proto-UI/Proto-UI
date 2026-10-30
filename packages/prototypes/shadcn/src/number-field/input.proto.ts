import type { NumberFieldInputExposes } from '@proto.ui/prototypes-base/number-field';
import { definePrototype, tw } from '@proto.ui/core';
import { asNumberFieldInput } from '@proto.ui/prototypes-base/number-field';
import { setupInputVisual } from '../input/visual';
import type { ShadcnNumberFieldPartProps } from './types';

/** Proto numeric draft editor borrowing pinned Input paint, not an upstream NumberField API. */
export default definePrototype<ShadcnNumberFieldPartProps, NumberFieldInputExposes>({
  name: 'shadcn-number-field-input',
  modules: asNumberFieldInput.modules,
  setup(def) {
    const inherited = asNumberFieldInput();
    setupInputVisual(def, inherited.stateHandles!, undefined, true);
    def.feedback.style.use(tw('block flex-1 tabular-nums'));
    return inherited.render;
  },
});
