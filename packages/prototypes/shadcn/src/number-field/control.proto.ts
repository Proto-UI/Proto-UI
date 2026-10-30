import type { NumberFieldControlExposes } from '@proto.ui/prototypes-base/number-field';
import { definePrototype, tw } from '@proto.ui/core';
import { asNumberFieldControl } from '@proto.ui/prototypes-base/number-field';
import { setupInputVisual } from '../input/visual';
import type { ShadcnNumberFieldPartProps } from './types';

export default definePrototype<ShadcnNumberFieldPartProps, NumberFieldControlExposes>({
  name: 'shadcn-number-field-control',
  modules: asNumberFieldControl.modules,
  setup(def) {
    const inherited = asNumberFieldControl();
    const binding = inherited.getAsHookHandle?.('as-field-control');
    if (!inherited.stateHandles || !binding)
      throw new Error('[shadcn-number-field-control] Missing Base editor or Field binding.');
    setupInputVisual(def, inherited.stateHandles, binding.state.invalid, true);
    def.feedback.style.use(tw('block flex-1 tabular-nums'));
    return inherited.render;
  },
});
