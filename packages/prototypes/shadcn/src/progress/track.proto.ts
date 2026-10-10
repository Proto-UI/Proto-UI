import { definePrototype, tw } from '@proto.ui/core';
import {
  type ProgressPartProps,
  type ProgressPartExposes,
  asProgressTrack,
} from '@proto.ui/prototypes-base/progress';
export default definePrototype<ProgressPartProps, ProgressPartExposes>({
  name: 'shadcn-progress-track',
  setup(def) {
    const inherited = asProgressTrack();
    def.feedback.style.use(tw('block h-3 w-full overflow-hidden rounded-full bg-muted'));
    return inherited.render;
  },
});
