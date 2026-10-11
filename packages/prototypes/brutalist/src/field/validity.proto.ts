import { definePrototype, tw } from '@proto.ui/core';
import {
  asFieldValidity,
  type FieldValidityProps,
  type FieldValidityExposes,
} from '@proto.ui/prototypes-base/field';
export default definePrototype<FieldValidityProps, FieldValidityExposes>({
  name: 'brutalist-field-validity',
  setup(def) {
    const inherited = asFieldValidity();
    def.feedback.style.use(tw('block text-sm font-sans text-foreground'));
    return inherited.render;
  },
});
