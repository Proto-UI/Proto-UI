import { definePrototype, tw } from '@proto.ui/core';
import {
  asFieldDescription,
  type FieldDescriptionProps,
  type FieldDescriptionExposes,
} from '@proto.ui/prototypes-base/field';
export default definePrototype<FieldDescriptionProps, FieldDescriptionExposes>({
  name: 'liquid-glass-field-description',
  setup(def) {
    const inherited = asFieldDescription();
    def.feedback.style.use(tw('block px-1 text-sm leading-relaxed text-foreground break-words'));
    return inherited.render;
  },
});
