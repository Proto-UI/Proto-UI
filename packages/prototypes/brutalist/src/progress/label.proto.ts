import { definePrototype, tw } from '@proto.ui/core';
import { asProgressLabel } from '@proto.ui/prototypes-base/progress';
export default definePrototype({
  name: 'brutalist-progress-label',
  setup(def) {
    const inherited = asProgressLabel();
    def.feedback.style.use(tw('text-sm font-bold uppercase'));
    return inherited.render;
  },
});
