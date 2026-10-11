import { definePrototype, tw } from '@proto.ui/core';
import {
  asFieldError,
  type FieldErrorProps,
  type FieldErrorExposes,
} from '@proto.ui/prototypes-base/field';
export default definePrototype<FieldErrorProps, FieldErrorExposes>({
  name: 'liquid-glass-field-error',
  setup(def) {
    const inherited = asFieldError();
    def.feedback.style.use(
      tw('block px-1 text-sm font-medium leading-relaxed text-foreground break-words')
    );
    return inherited.render;
  },
});
