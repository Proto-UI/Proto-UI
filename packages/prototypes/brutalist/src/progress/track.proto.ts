import { definePrototype, tw } from '@proto.ui/core';
import { asProgressTrack } from '@proto.ui/prototypes-base/progress';
export default definePrototype({
  name: 'brutalist-progress-track',
  setup(def) {
    const inherited = asProgressTrack();
    def.feedback.style.use(
      tw('block h-3 w-full overflow-hidden rounded-none border-2 border-border bg-muted')
    );
    return inherited.render;
  },
});
