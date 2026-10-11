import { definePrototype, tw } from '@proto.ui/core';
import {
  type ProgressPartProps,
  type ProgressPartExposes,
  asProgressTrack,
} from '@proto.ui/prototypes-base/progress';
export default definePrototype<ProgressPartProps, ProgressPartExposes>({
  name: 'bootstrap-2-3-2-progress-track',
  setup(def) {
    const inherited = asProgressTrack();
    def.feedback.style.use(tw('block h-5 w-full overflow-hidden rounded-[4px] bg-muted'));
    return inherited.render;
  },
});
