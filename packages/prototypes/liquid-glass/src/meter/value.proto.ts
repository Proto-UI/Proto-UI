import { definePrototype, tw } from '@proto.ui/core';
import {
  type MeterPartProps,
  type MeterPartExposes,
  asMeterValue,
} from '@proto.ui/prototypes-base/meter';
export default definePrototype<MeterPartProps, MeterPartExposes>({
  name: 'liquid-glass-meter-value',
  modules: asMeterValue.modules,
  setup(def) {
    const inherited = asMeterValue();
    def.feedback.style.use(tw('ms-auto font-sans text-sm tabular-nums text-muted-foreground'));
    return inherited.render;
  },
});
