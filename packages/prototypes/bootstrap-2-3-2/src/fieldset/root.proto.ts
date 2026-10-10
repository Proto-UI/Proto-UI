import type { FieldsetRootProps, FieldsetRootExposes } from '@proto.ui/prototypes-base/fieldset';
import { definePrototype, tw } from '@proto.ui/core';
import { asFieldsetRoot } from '@proto.ui/prototypes-base/fieldset';
export default definePrototype<FieldsetRootProps, FieldsetRootExposes>({
  name: 'bootstrap-2-3-2-fieldset-root',
  setup(def) {
    const inherited = asFieldsetRoot();
    def.feedback.style.use(
      tw(
        'flex w-full min-w-0 flex-col gap-2 text-foreground rounded-[4px] border border-border p-4'
      )
    );
    return inherited.render;
  },
});
