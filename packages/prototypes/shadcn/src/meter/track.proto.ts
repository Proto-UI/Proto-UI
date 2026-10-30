import { definePrototype } from '@proto.ui/core';
import { type MeterPartExposes, asMeterTrack } from '@proto.ui/prototypes-base/meter';
import { setupMeterTrackPaint } from './visual';
import type { ShadcnMeterPartProps } from './types';
export default definePrototype<ShadcnMeterPartProps, MeterPartExposes>({
  name: 'shadcn-meter-track',
  modules: asMeterTrack.modules,
  setup(def) {
    const inherited = asMeterTrack();
    setupMeterTrackPaint(def);
    return inherited.render;
  },
});
