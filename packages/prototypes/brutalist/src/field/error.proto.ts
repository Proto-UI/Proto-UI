import { definePrototype, tw } from '@proto.ui/core';
import {
  asFieldError,
  type FieldErrorProps,
  type FieldErrorExposes,
} from '@proto.ui/prototypes-base/field';
export default definePrototype<FieldErrorProps, FieldErrorExposes>({
  name: 'brutalist-field-error',
  setup(def) {
    const inherited = asFieldError();
    def.feedback.style.use(
      tw('block border-l-2 border-foreground pl-2 text-sm font-bold text-foreground break-words')
    );
    return inherited.render;
  },
});
