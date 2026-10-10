import { definePrototype, tw } from '@proto.ui/core';
import { asProgressLabel } from '@proto.ui/prototypes-base/progress';
export default definePrototype({
  name: 'shadcn-progress-label',
  setup(def) {
    const inherited = asProgressLabel();
    def.feedback.style.use(tw('text-sm font-medium'));
    return inherited.render;
  },
});
