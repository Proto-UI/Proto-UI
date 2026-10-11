import { definePrototype, tw } from '@proto.ui/core';
import {
  asFieldValidity,
  type FieldValidityProps,
  type FieldValidityExposes,
} from '@proto.ui/prototypes-base/field';
export default definePrototype<FieldValidityProps, FieldValidityExposes>({
  name: 'liquid-glass-field-validity',
  setup(def) {
    const inherited = asFieldValidity();
    def.feedback.style.use(tw('block px-1 text-sm text-foreground'));
    return inherited.render;
  },
});
