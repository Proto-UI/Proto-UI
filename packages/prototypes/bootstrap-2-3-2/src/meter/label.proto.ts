import { definePrototype, tw } from '@proto.ui/core';
import {
  type MeterPartProps,
  type MeterPartExposes,
  asMeterLabel,
} from '@proto.ui/prototypes-base/meter';
export default definePrototype<MeterPartProps, MeterPartExposes>({
  name: 'bootstrap-2-3-2-meter-label',
  modules: asMeterLabel.modules,
  setup(def) {
    const inherited = asMeterLabel();
    def.feedback.style.use(tw('text-[14px] leading-[20px] font-normal'));
    return inherited.render;
  },
});
