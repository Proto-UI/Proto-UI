import { definePrototype, tw } from '@proto.ui/core';
import {
  type MeterRootProps,
  type MeterRootExposes,
  asMeterRoot,
} from '@proto.ui/prototypes-base/meter';
export default definePrototype<MeterRootProps, MeterRootExposes>({
  name: 'bootstrap-2-3-2-meter-root',
  modules: asMeterRoot.modules,
  setup(def) {
    const inherited = asMeterRoot();
    // Meter is a Proto extension. It borrows the historical progress grammar,
    // not Progress's semantic role or an unshipped Bootstrap Meter protocol.
    def.feedback.style.use(
      tw(
        'flex w-full min-w-0 flex-col gap-[5px] mb-[20px] font-sans text-[14px] leading-[20px] text-foreground'
      )
    );
    return inherited.render;
  },
});
