import { definePrototype, tw } from '@proto.ui/core';
import {
  type ProgressPartProps,
  type ProgressPartExposes,
  asProgressValue,
} from '@proto.ui/prototypes-base/progress';
export default definePrototype<ProgressPartProps, ProgressPartExposes>({
  name: 'bootstrap-2-3-2-progress-value',
  modules: asProgressValue.modules,
  setup(def) {
    const inherited = asProgressValue();
    def.feedback.style.use(tw('text-[14px] leading-[20px] font-normal text-foreground'));
    return inherited.render;
  },
});
