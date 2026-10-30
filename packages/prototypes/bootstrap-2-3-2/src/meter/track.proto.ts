import { definePrototype, tw } from '@proto.ui/core';
import {
  type MeterPartProps,
  type MeterPartExposes,
  asMeterTrack,
} from '@proto.ui/prototypes-base/meter';
export default definePrototype<MeterPartProps, MeterPartExposes>({
  name: 'bootstrap-2-3-2-meter-track',
  modules: asMeterTrack.modules,
  setup(def) {
    const inherited = asMeterTrack();
    def.feedback.style.use(
      tw(
        'block h-[20px] w-full overflow-hidden rounded-[4px] bg-[#f7f7f7_linear-gradient(#f5f5f5,#f9f9f9)_0_0_repeat-x] shadow-[inset_0_1px_2px_rgb(0_0_0/10%)]'
      )
    );
    return inherited.render;
  },
});
