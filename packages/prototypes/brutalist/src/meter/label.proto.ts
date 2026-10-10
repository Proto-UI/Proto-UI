import { definePrototype, tw } from '@proto.ui/core';
import {
  type MeterPartProps,
  type MeterPartExposes,
  asMeterLabel,
} from '@proto.ui/prototypes-base/meter';
export default definePrototype<MeterPartProps, MeterPartExposes>({
  name: 'brutalist-meter-label',
  setup(def) {
    const inherited = asMeterLabel();
    def.feedback.style.use(tw('text-sm font-bold uppercase'));
    return inherited.render;
  },
});
