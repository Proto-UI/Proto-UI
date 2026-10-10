import { definePrototype, tw } from '@proto.ui/core';
import {
  type ProgressPartProps,
  type ProgressPartExposes,
  asProgressLabel,
} from '@proto.ui/prototypes-base/progress';
export default definePrototype<ProgressPartProps, ProgressPartExposes>({
  name: 'bootstrap-2-3-2-progress-label',
  setup(def) {
    const inherited = asProgressLabel();
    def.feedback.style.use(tw('text-sm leading-5 font-medium'));
    return inherited.render;
  },
});
