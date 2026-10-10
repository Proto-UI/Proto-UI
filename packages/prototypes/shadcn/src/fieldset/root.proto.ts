import { definePrototype, tw } from '@proto.ui/core';
import { asFieldsetRoot } from '@proto.ui/prototypes-base/fieldset';
export default definePrototype({
  name: 'shadcn-fieldset-root',
  setup(def) {
    const inherited = asFieldsetRoot();
    def.feedback.style.use(
      tw('flex w-full min-w-0 flex-col gap-3 text-foreground rounded-lg border border-border p-4')
    );
    return inherited.render;
  },
});
