import { definePrototype, tw } from '@proto.ui/core';
import { asProgressValue } from '@proto.ui/prototypes-base/progress';
export default definePrototype({
  name: 'brutalist-progress-value',
  setup(def) {
    const inherited = asProgressValue();
    def.feedback.style.use(tw('text-sm tabular-nums text-muted-foreground'));
    return inherited.render;
  },
});
