import { definePrototype } from '@proto.ui/core';
import { asFieldLabel, type FieldLabelExposes } from '@proto.ui/prototypes-base/field';
import type { ShadcnFieldLabelProps } from './types';
import { setupFieldTextVisual } from './visual';
export default definePrototype<ShadcnFieldLabelProps, FieldLabelExposes>({
  name: 'shadcn-field-label',
  modules: asFieldLabel.modules,
  setup(def) {
    const inherited = asFieldLabel();
    setupFieldTextVisual(def, 'label', inherited.stateHandles!.disabled);
    return inherited.render;
  },
});
