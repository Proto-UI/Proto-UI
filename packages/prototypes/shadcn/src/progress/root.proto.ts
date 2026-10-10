import { definePrototype, tw } from '@proto.ui/core';
import { asProgressRoot } from '@proto.ui/prototypes-base/progress';
export default definePrototype({
  name: 'shadcn-progress-root',
  setup(def) {
    const inherited = asProgressRoot();
    def.feedback.style.use(tw('flex w-full min-w-0 flex-col gap-2 text-foreground'));
    return inherited.render;
  },
});
