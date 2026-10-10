import { definePrototype, tw } from '@proto.ui/core';
import {
  type ProgressPartProps,
  type ProgressPartExposes,
  asProgressLabel,
} from '@proto.ui/prototypes-base/progress';
export default definePrototype<ProgressPartProps, ProgressPartExposes>({
  name: 'shadcn-progress-label',
  setup(def) {
    const inherited = asProgressLabel();
    def.feedback.style.use(tw('text-sm font-medium'));
    return inherited.render;
  },
});
