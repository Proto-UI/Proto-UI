import { definePrototype, tw } from '@proto.ui/core';
import {
  type ProgressRootProps,
  type ProgressRootExposes,
  asProgressRoot,
} from '@proto.ui/prototypes-base/progress';
export default definePrototype<ProgressRootProps, ProgressRootExposes>({
  name: 'bootstrap-2-3-2-progress-root',
  modules: asProgressRoot.modules,
  setup(def) {
    const inherited = asProgressRoot();
    // The semantic Root also carries .progress's 20px outer spacing. Label
    // and Value are Proto accessibility/readout parts, not upstream classes.
    def.feedback.style.use(
      tw(
        'flex w-full min-w-0 flex-col gap-[5px] mb-[20px] font-sans text-[14px] leading-[20px] text-foreground'
      )
    );
    return inherited.render;
  },
});
