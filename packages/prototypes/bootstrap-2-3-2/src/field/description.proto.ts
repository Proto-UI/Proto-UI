import { definePrototype, tw } from '@proto.ui/core';
import {
  asFieldDescription,
  type FieldDescriptionProps,
  type FieldDescriptionExposes,
} from '@proto.ui/prototypes-base/field';
export default definePrototype<FieldDescriptionProps, FieldDescriptionExposes>({
  name: 'bootstrap-2-3-2-field-description',
  setup(def) {
    const inherited = asFieldDescription();
    def.feedback.style.use(
      tw('block mb-[10px] text-[14px] leading-[20px] text-inherit break-words')
    );
    return inherited.render;
  },
});
