import type { FieldsetRootProps, FieldsetRootExposes } from '@proto.ui/prototypes-base/fieldset';
import { definePrototype, tw } from '@proto.ui/core';
import { asFieldsetRoot } from '@proto.ui/prototypes-base/fieldset';
export default definePrototype<FieldsetRootProps, FieldsetRootExposes>({
  name: 'shadcn-fieldset-root',
  setup(def) {
    const inherited = asFieldsetRoot();
    def.feedback.style.use(tw('flex w-full min-w-0 flex-col gap-4 text-foreground'));
    return inherited.render;
  },
});
