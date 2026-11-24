import { definePrototype, tw } from '@proto.ui/core';
import {
  type MeterPartProps,
  type MeterPartExposes,
  asMeterTrack,
} from '@proto.ui/prototypes-base/meter';
export default definePrototype<MeterPartProps, MeterPartExposes>({
  name: 'liquid-glass-meter-track',
  modules: asMeterTrack.modules,
  setup(def) {
    const inherited = asMeterTrack();
    // Nonmaterial content-layer gauge track per Apple HIG Materials guidance.
    def.feedback.style.use(
      tw(
        'block h-2.5 w-full overflow-hidden rounded-full border border-border bg-muted shadow-inner'
      )
    );
    return inherited.render;
  },
});
