import type { FieldsetPartProps, FieldsetRootExposes } from '@proto.ui/prototypes-base/fieldset';
import { definePrototype, tw } from '@proto.ui/core';
import { asFieldsetLegend } from '@proto.ui/prototypes-base/fieldset';
export default definePrototype<FieldsetPartProps, FieldsetRootExposes>({
  name: 'brutalist-fieldset-legend',
  setup(def) {
    const inherited = asFieldsetLegend();
    def.feedback.style.use(tw('mb-1.5 font-sans text-base font-bold'));
    return inherited.render;
  },
});
