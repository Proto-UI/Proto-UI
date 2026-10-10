import type { FieldsetPartProps, FieldsetRootExposes } from '@proto.ui/prototypes-base/fieldset';
import { definePrototype, tw } from '@proto.ui/core';
import { asFieldsetDescription } from '@proto.ui/prototypes-base/fieldset';
export default definePrototype<FieldsetPartProps, FieldsetRootExposes>({
  name: 'liquid-glass-fieldset-description',
  setup(def) {
    const inherited = asFieldsetDescription();
    def.feedback.style.use(tw('text-sm text-muted-foreground'));
    return inherited.render;
  },
});
