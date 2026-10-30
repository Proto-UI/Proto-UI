import { definePrototype } from '@proto.ui/core';
import { asFieldError, type FieldErrorExposes } from '@proto.ui/prototypes-base/field';
import type { ShadcnFieldErrorProps } from './types';
import { setupFieldTextVisual } from './visual';
export default definePrototype<ShadcnFieldErrorProps, FieldErrorExposes>({
  name: 'shadcn-field-error',
  modules: asFieldError.modules,
  setup(def) {
    const inherited = asFieldError();
    setupFieldTextVisual(def, 'error');
    return inherited.render;
  },
});
