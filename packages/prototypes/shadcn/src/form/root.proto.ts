import { definePrototype, tw } from '@proto.ui/core';
import { asFormRoot } from '@proto.ui/prototypes-base/form';
export default definePrototype({
  name: 'shadcn-form-root',
  setup(def) {
    const inherited = asFormRoot();
    def.feedback.style.use(tw('flex w-full min-w-0 flex-col gap-3 text-foreground'));
    return inherited.render;
  },
});
