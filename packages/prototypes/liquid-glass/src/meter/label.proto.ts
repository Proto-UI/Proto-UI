import { definePrototype, tw } from '@proto.ui/core';
import {
  type MeterPartProps,
  type MeterPartExposes,
  asMeterLabel,
} from '@proto.ui/prototypes-base/meter';
export default definePrototype<MeterPartProps, MeterPartExposes>({
  name: 'liquid-glass-meter-label',
  modules: asMeterLabel.modules,
  setup(def) {
    const inherited = asMeterLabel();
    def.feedback.style.use(tw('font-sans text-sm font-medium text-foreground'));
    return inherited.render;
  },
});
