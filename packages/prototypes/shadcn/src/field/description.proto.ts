import { definePrototype } from '@proto.ui/core';
import { asFieldDescription, type FieldDescriptionExposes } from '@proto.ui/prototypes-base/field';
import type { ShadcnFieldDescriptionProps } from './types';
import { setupFieldTextVisual } from './visual';
export default definePrototype<ShadcnFieldDescriptionProps, FieldDescriptionExposes>({
  name: 'shadcn-field-description',
  modules: asFieldDescription.modules,
  setup(def) {
    const inherited = asFieldDescription();
    setupFieldTextVisual(def, 'description');
    return inherited.render;
  },
});
