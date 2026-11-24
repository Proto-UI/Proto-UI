import { definePrototype, tw } from '@proto.ui/core';
import {
  type ProgressPartProps,
  type ProgressPartExposes,
  asProgressLabel,
} from '@proto.ui/prototypes-base/progress';
export default definePrototype<ProgressPartProps, ProgressPartExposes>({
  name: 'brutalist-progress-label',
  modules: asProgressLabel.modules,
  setup(def) {
    const inherited = asProgressLabel();
    def.feedback.style.use(tw('font-sans text-sm font-medium text-foreground'));
    return inherited.render;
  },
});
