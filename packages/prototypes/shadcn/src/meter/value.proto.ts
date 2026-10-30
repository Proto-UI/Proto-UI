import { definePrototype } from '@proto.ui/core';
import { type MeterPartExposes, asMeterValue } from '@proto.ui/prototypes-base/meter';
import { setupMeterValuePaint } from './visual';
import type { ShadcnMeterPartProps } from './types';
export default definePrototype<ShadcnMeterPartProps, MeterPartExposes>({
  name: 'shadcn-meter-value',
  modules: asMeterValue.modules,
  setup(def) {
    const inherited = asMeterValue();
    setupMeterValuePaint(def);
    return inherited.render;
  },
});
