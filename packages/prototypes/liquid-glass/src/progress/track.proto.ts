import { definePrototype, tw } from '@proto.ui/core';
import {
  type ProgressPartProps,
  type ProgressPartExposes,
  asProgressTrack,
} from '@proto.ui/prototypes-base/progress';
export default definePrototype<ProgressPartProps, ProgressPartExposes>({
  name: 'liquid-glass-progress-track',
  setup(def) {
    const inherited = asProgressTrack();
    def.feedback.style.use(
      tw('block h-4 w-full overflow-hidden rounded-full border border-border bg-muted')
    );
    return inherited.render;
  },
});
