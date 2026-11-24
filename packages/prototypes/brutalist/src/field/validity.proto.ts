import { definePrototype, tw } from '@proto.ui/core';
import {
  asFieldValidity,
  type FieldValidityProps,
  type FieldValidityExposes,
} from '@proto.ui/prototypes-base/field';

export default definePrototype<FieldValidityProps, FieldValidityExposes>({
  name: 'brutalist-field-validity',
  modules: asFieldValidity.modules,
  setup(def) {
    const inherited = asFieldValidity();
    def.feedback.style.use(tw('block font-sans text-sm font-medium text-muted-foreground'));
    return inherited.render;
  },
});
