import type { FieldsetPartProps, FieldsetRootExposes } from '@proto.ui/prototypes-base/fieldset';
import { definePrototype, tw } from '@proto.ui/core';
import { asFieldsetDescription } from '@proto.ui/prototypes-base/fieldset';

export default definePrototype<FieldsetPartProps, FieldsetRootExposes>({
  name: 'liquid-glass-fieldset-description',
  modules: asFieldsetDescription.modules,
  setup(def) {
    const inherited = asFieldsetDescription();
    def.feedback.style.use(tw('text-sm leading-normal text-muted-foreground break-words'));
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('cursor-not-allowed')),
    });
    return inherited.render;
  },
});
