import { definePrototype, tw } from '@proto.ui/core';
import {
  asFieldError,
  type FieldErrorProps,
  type FieldErrorExposes,
} from '@proto.ui/prototypes-base/field';

export default definePrototype<FieldErrorProps, FieldErrorExposes>({
  name: 'liquid-glass-field-error',
  modules: asFieldError.modules,
  setup(def) {
    const inherited = asFieldError();
    def.feedback.style.use(
      tw('block px-1 text-sm font-medium leading-relaxed text-destructive break-words')
    );
    return inherited.render;
  },
});
