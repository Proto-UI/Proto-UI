import { definePrototype, tw } from '@proto.ui/core';
import { type MeterPartExposes, asMeterIndicator } from '@proto.ui/prototypes-base/meter';
import { setupMeterStyle } from './visual';
import type { ShadcnMeterPartProps } from './types';
export default definePrototype<ShadcnMeterPartProps, MeterPartExposes>({
  name: 'shadcn-meter-indicator',
  modules: asMeterIndicator.modules,
  setup(def) {
    const inherited = asMeterIndicator();
    setupMeterStyle(def);
    def.feedback.style.use(
      tw('block h-full w-[calc(var(--pui-percentage)*1%)] bg-primary transition-all')
    );
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.status).eq('critical'),
      intent: (i) => i.feedback.style.use(tw('bg-destructive')),
    });
    return inherited.render;
  },
});
