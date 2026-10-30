import { definePrototype } from '@proto.ui/core';
import { asFieldTextControl, type FieldControlExposes } from '@proto.ui/prototypes-base/field';
import { setupInputVisual } from '../input/visual';
import type { ShadcnFieldControlProps } from './types';

export default definePrototype<ShadcnFieldControlProps, FieldControlExposes>({
  name: 'shadcn-field-control',
  modules: asFieldTextControl.modules,
  setup(def) {
    const inherited = asFieldTextControl();
    const binding = inherited.getAsHookHandle?.('as-field-control');
    if (!inherited.stateHandles || !binding)
      throw new Error('[field-control] Base editor and Field binding handles required.');
    setupInputVisual(def, inherited.stateHandles, binding.state.invalid, true);
    return inherited.render;
  },
});
