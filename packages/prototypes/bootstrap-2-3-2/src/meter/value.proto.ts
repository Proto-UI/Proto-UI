import { definePrototype, tw } from '@proto.ui/core';
import {
  type MeterPartProps,
  type MeterPartExposes,
  asMeterValue,
} from '@proto.ui/prototypes-base/meter';
export default definePrototype<MeterPartProps, MeterPartExposes>({
  name: 'bootstrap-2-3-2-meter-value',
  modules: asMeterValue.modules,
  setup(def) {
    const inherited = asMeterValue();
    def.feedback.style.use(tw('text-[14px] leading-[20px] font-normal text-foreground'));
    return inherited.render;
  },
});
