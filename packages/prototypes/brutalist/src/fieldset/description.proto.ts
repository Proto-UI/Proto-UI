import type { FieldsetPartProps, FieldsetRootExposes } from '@proto.ui/prototypes-base/fieldset';
import { definePrototype, tw } from '@proto.ui/core';
import { asFieldsetDescription } from '@proto.ui/prototypes-base/fieldset';
export default definePrototype<FieldsetPartProps, FieldsetRootExposes>({
  name: 'brutalist-fieldset-description',
  setup(def) {
    const inherited = asFieldsetDescription();
    def.feedback.style.use(
      tw('text-left font-sans text-sm font-medium leading-normal text-foreground break-words')
    );
    return inherited.render;
  },
});
