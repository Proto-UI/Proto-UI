import { definePrototype, tw } from '@proto.ui/core';
import {
  type MeterPartProps,
  type MeterPartExposes,
  asMeterLabel,
} from '@proto.ui/prototypes-base/meter';
export default definePrototype<MeterPartProps, MeterPartExposes>({
  name: 'bootstrap-2-3-2-meter-label',
  setup(def) {
    const inherited = asMeterLabel();
    def.feedback.style.use(tw('text-sm leading-5 font-medium'));
    return inherited.render;
  },
});
