import type { FieldsetPartProps, FieldsetRootExposes } from '@proto.ui/prototypes-base/fieldset';
import { definePrototype, tw } from '@proto.ui/core';
import { asFieldsetLegend } from '@proto.ui/prototypes-base/fieldset';
export default definePrototype<FieldsetPartProps, FieldsetRootExposes>({
  name: 'bootstrap-2-3-2-fieldset-legend',
  setup(def) {
    const inherited = asFieldsetLegend();
    def.feedback.style.use(
      tw(
        'block w-full m-0 mb-5 p-0 border-0 border-b border-[#e5e5e5] text-[1.3125rem] font-normal leading-[2.5rem] text-foreground'
      )
    );
    return inherited.render;
  },
});
