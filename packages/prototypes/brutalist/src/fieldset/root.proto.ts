import type { FieldsetRootProps, FieldsetRootExposes } from '@proto.ui/prototypes-base/fieldset';
import { definePrototype, tw } from '@proto.ui/core';
import { asFieldsetRoot } from '@proto.ui/prototypes-base/fieldset';

export default definePrototype<FieldsetRootProps, FieldsetRootExposes>({
  name: 'brutalist-fieldset-root',
  modules: asFieldsetRoot.modules,
  setup(def) {
    const inherited = asFieldsetRoot();
    def.feedback.style.use(
      tw('flex w-full min-w-0 flex-col gap-4 font-sans font-medium text-foreground')
    );
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('cursor-not-allowed')),
    });
    return inherited.render;
  },
});
