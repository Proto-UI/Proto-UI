import { definePrototype, tw } from '@proto.ui/core';
import {
  type ProgressPartProps,
  type ProgressPartExposes,
  asProgressValue,
} from '@proto.ui/prototypes-base/progress';
export default definePrototype<ProgressPartProps, ProgressPartExposes>({
  name: 'liquid-glass-progress-value',
  modules: asProgressValue.modules,
  setup(def) {
    const inherited = asProgressValue();
    def.feedback.style.use(
      tw('ms-auto font-sans text-sm font-medium tabular-nums text-muted-foreground')
    );
    return inherited.render;
  },
});
