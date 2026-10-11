import { definePrototype, tw } from '@proto.ui/core';
import {
  type MeterPartProps,
  type MeterPartExposes,
  asMeterTrack,
} from '@proto.ui/prototypes-base/meter';
export default definePrototype<MeterPartProps, MeterPartExposes>({
  name: 'shadcn-meter-track',
  setup(def) {
    const inherited = asMeterTrack();
    def.feedback.style.use(tw('block h-3 w-full overflow-hidden rounded-full bg-muted'));
    return inherited.render;
  },
});
