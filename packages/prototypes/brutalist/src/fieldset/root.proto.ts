import type { FieldsetRootProps, FieldsetRootExposes } from '@proto.ui/prototypes-base/fieldset';
import { definePrototype, tw } from '@proto.ui/core';
import { asFieldsetRoot } from '@proto.ui/prototypes-base/fieldset';
export default definePrototype<FieldsetRootProps, FieldsetRootExposes>({
  name: 'brutalist-fieldset-root',
  setup(def) {
    const inherited = asFieldsetRoot();
    def.feedback.style.use(
      tw(
        'flex w-full min-w-0 flex-col gap-3 text-foreground rounded-none border-2 border border-border p-4'
      )
    );
    return inherited.render;
  },
});
