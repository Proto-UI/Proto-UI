import type { FieldsetRootProps, FieldsetRootExposes } from '@proto.ui/prototypes-base/fieldset';
import { definePrototype, tw } from '@proto.ui/core';
import { asFieldsetRoot } from '@proto.ui/prototypes-base/fieldset';
export default definePrototype<FieldsetRootProps, FieldsetRootExposes>({
  name: 'bootstrap-2-3-2-fieldset-root',
  setup(def) {
    const inherited = asFieldsetRoot();
    def.feedback.style.use(tw('block w-full min-w-0 m-0 p-0 border-0 text-foreground'));
    return inherited.render;
  },
});
