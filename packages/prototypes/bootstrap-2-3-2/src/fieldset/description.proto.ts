import type { FieldsetPartProps, FieldsetRootExposes } from '@proto.ui/prototypes-base/fieldset';
import { definePrototype, tw } from '@proto.ui/core';
import { asFieldsetDescription } from '@proto.ui/prototypes-base/fieldset';
export default definePrototype<FieldsetPartProps, FieldsetRootExposes>({
  name: 'bootstrap-2-3-2-fieldset-description',
  setup(def) {
    const inherited = asFieldsetDescription();
    def.feedback.style.use(
      tw('block mb-[10px] text-[14px] font-normal leading-[20px] text-[#555] break-words')
    );
    return inherited.render;
  },
});
