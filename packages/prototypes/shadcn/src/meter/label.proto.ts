import { definePrototype } from '@proto.ui/core';
import { type MeterPartExposes, asMeterLabel } from '@proto.ui/prototypes-base/meter';
import { setupMeterLabelPaint } from './visual';
import type { ShadcnMeterPartProps } from './types';
export default definePrototype<ShadcnMeterPartProps, MeterPartExposes>({
  name: 'shadcn-meter-label',
  modules: asMeterLabel.modules,
  setup(def) {
    const inherited = asMeterLabel();
    setupMeterLabelPaint(def);
    return inherited.render;
  },
});
