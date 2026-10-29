import { definePrototype, tw } from '@proto.ui/core';
import {
  type ProgressPartProps,
  type ProgressPartExposes,
  asProgressLabel,
} from '@proto.ui/prototypes-base/progress';
export default definePrototype<ProgressPartProps, ProgressPartExposes>({
  name: 'bootstrap-2-3-2-progress-label',
  modules: asProgressLabel.modules,
  setup(def) {
    const inherited = asProgressLabel();
    def.feedback.style.use(tw('text-[14px] leading-[20px] font-normal'));
    return inherited.render;
  },
});
