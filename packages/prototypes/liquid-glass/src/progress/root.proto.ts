import { definePrototype, tw } from '@proto.ui/core';
import {
  type ProgressRootProps,
  type ProgressRootExposes,
  asProgressRoot,
} from '@proto.ui/prototypes-base/progress';
export default definePrototype<ProgressRootProps, ProgressRootExposes>({
  name: 'liquid-glass-progress-root',
  setup(def) {
    const inherited = asProgressRoot();
    def.feedback.style.use(tw('flex w-full min-w-0 flex-col gap-3 text-foreground'));
    return inherited.render;
  },
});
