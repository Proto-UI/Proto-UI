import { definePrototype } from '@proto.ui/core';
import { asFieldValidity, type FieldValidityExposes } from '@proto.ui/prototypes-base/field';
import type { ShadcnFieldValidityProps } from './types';
import { setupFieldTextVisual } from './visual';
export default definePrototype<ShadcnFieldValidityProps, FieldValidityExposes>({
  name: 'shadcn-field-validity',
  modules: asFieldValidity.modules,
  setup(def) {
    const inherited = asFieldValidity();
    setupFieldTextVisual(def, 'validity');
    return inherited.render;
  },
});
