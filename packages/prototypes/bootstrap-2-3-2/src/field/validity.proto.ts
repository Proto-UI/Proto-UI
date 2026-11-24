import { definePrototype, tw } from '@proto.ui/core';
import {
  asFieldValidity,
  type FieldValidityProps,
  type FieldValidityExposes,
} from '@proto.ui/prototypes-base/field';

export default definePrototype<FieldValidityProps, FieldValidityExposes>({
  name: 'bootstrap-2-3-2-field-validity',
  modules: asFieldValidity.modules,
  setup(def) {
    const inherited = asFieldValidity();
    def.feedback.style.use(tw('block text-[14px] leading-[20px] text-muted-foreground'));
    return inherited.render;
  },
});
