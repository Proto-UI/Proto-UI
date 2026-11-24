import { definePrototype, tw } from '@proto.ui/core';
import {
  type MeterPartProps,
  type MeterPartExposes,
  asMeterTrack,
} from '@proto.ui/prototypes-base/meter';
export default definePrototype<MeterPartProps, MeterPartExposes>({
  name: 'brutalist-meter-track',
  modules: asMeterTrack.modules,
  setup(def) {
    const inherited = asMeterTrack();
    def.feedback.style.use(
      tw(
        'block h-4 w-full overflow-hidden rounded-base border-2 border-black bg-secondary-background'
      )
    );
    return inherited.render;
  },
});
