import { definePrototype, tw } from '@proto.ui/core';
import {
  type MeterPartProps,
  type MeterPartExposes,
  asMeterTrack,
} from '@proto.ui/prototypes-base/meter';
export default definePrototype<MeterPartProps, MeterPartExposes>({
  name: 'bootstrap-2-3-2-meter-track',
  setup(def) {
    const inherited = asMeterTrack();
    def.feedback.style.use(tw('block h-5 w-full overflow-hidden rounded-[4px] bg-muted'));
    return inherited.render;
  },
});
