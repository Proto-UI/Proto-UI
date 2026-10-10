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
      tw('block font-sans text-sm font-medium leading-normal text-destructive-ink break-words')
    );
    return inherited.render;
  },
});
