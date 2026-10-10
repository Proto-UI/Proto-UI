import { definePrototype, tw } from '@proto.ui/core';
import {
  asFieldError,
  type FieldErrorProps,
  type FieldErrorExposes,
} from '@proto.ui/prototypes-base/field';
export default definePrototype<FieldErrorProps, FieldErrorExposes>({
  name: 'bootstrap-2-3-2-field-error',
  setup(def) {
    const inherited = asFieldError();
    def.feedback.style.use(tw('block text-sm leading-5 text-destructive break-words'));
    return inherited.render;
  },
});
