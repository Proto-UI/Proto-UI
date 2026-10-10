import { definePrototype, tw } from '@proto.ui/core';
import { asFieldsetDescription } from '@proto.ui/prototypes-base/fieldset';
export default definePrototype({
  name: 'bootstrap-2-3-2-fieldset-description',
  setup(def) {
    const inherited = asFieldsetDescription();
    def.feedback.style.use(tw('text-sm text-muted-foreground'));
    return inherited.render;
  },
});
