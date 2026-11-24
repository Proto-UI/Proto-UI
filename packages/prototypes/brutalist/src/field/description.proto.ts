import { definePrototype, tw } from '@proto.ui/core';
import {
  asFieldDescription,
  type FieldDescriptionProps,
  type FieldDescriptionExposes,
} from '@proto.ui/prototypes-base/field';

export default definePrototype<FieldDescriptionProps, FieldDescriptionExposes>({
  name: 'brutalist-field-description',
  modules: asFieldDescription.modules,
  setup(def) {
    const inherited = asFieldDescription();
    def.feedback.style.use(
      tw('block font-sans text-sm font-medium leading-relaxed text-muted-foreground break-words')
    );
    return inherited.render;
  },
});
