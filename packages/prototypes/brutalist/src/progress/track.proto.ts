import { definePrototype, tw } from '@proto.ui/core';
import {
  type ProgressPartProps,
  type ProgressPartExposes,
  asProgressTrack,
} from '@proto.ui/prototypes-base/progress';
export default definePrototype<ProgressPartProps, ProgressPartExposes>({
  name: 'brutalist-progress-track',
  modules: asProgressTrack.modules,
  setup(def) {
    const inherited = asProgressTrack();
    def.feedback.style.use(
      tw(
        'relative flex h-4 w-full items-center overflow-hidden rounded-base border-2 border-border bg-secondary-background'
      )
    );
    return inherited.render;
  },
});
