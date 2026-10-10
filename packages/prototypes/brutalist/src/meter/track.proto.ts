import { definePrototype, tw } from '@proto.ui/core';
import { asMeterTrack } from '@proto.ui/prototypes-base/meter';
export default definePrototype({
  name: 'brutalist-meter-track',
  setup(def) {
    const inherited = asMeterTrack();
    def.feedback.style.use(
      tw('block h-3 w-full overflow-hidden rounded-none border-2 border-border bg-muted')
    );
    return inherited.render;
  },
});
