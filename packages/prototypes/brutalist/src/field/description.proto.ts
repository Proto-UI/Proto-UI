import { definePrototype, tw } from '@proto.ui/core';
import {
  asFieldDescription,
  type FieldDescriptionProps,
  type FieldDescriptionExposes,
} from '@proto.ui/prototypes-base/field';
export default definePrototype<FieldDescriptionProps, FieldDescriptionExposes>({
  name: 'brutalist-field-description',
  setup(def) {
    const inherited = asFieldDescription();
    def.feedback.style.use(tw('block text-sm leading-relaxed text-foreground break-words'));
    return inherited.render;
  },
});
