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
    def.feedback.style.use(
      tw('block mb-[10px] text-[14px] leading-[20px] text-destructive break-words')
    );
    return inherited.render;
  },
});
