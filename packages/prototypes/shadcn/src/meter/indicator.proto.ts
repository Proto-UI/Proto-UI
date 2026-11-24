import { definePrototype, tw } from '@proto.ui/core';
import { type MeterPartExposes, asMeterIndicator } from '@proto.ui/prototypes-base/meter';
import { setupMeterStyle } from './visual';
import type { ShadcnMeterPartProps } from './types';
export default definePrototype<ShadcnMeterPartProps, MeterPartExposes>({
  name: 'shadcn-meter-indicator',
  modules: asMeterIndicator.modules,
  setup(def) {
    const inherited = asMeterIndicator();
    const status = inherited.stateHandles!.status;
    setupMeterStyle(def);
    def.feedback.style.use(
      tw('block h-full w-[calc(var(--pui-percentage)*1%)] transition-all duration-200 ease-in-out')
    );
    def.rule({
      when: (w) => w.not(w.any(w.state(status).eq('suboptimal'), w.state(status).eq('critical'))),
      intent: (i) => i.feedback.style.use(tw('bg-primary')),
    });
    def.rule({
      when: (w) => w.state(status).eq('suboptimal'),
      intent: (i) => i.feedback.style.use(tw('bg-destructive/65')),
    });
    def.rule({
      when: (w) => w.state(status).eq('critical'),
      intent: (i) => i.feedback.style.use(tw('bg-destructive')),
    });
    return inherited.render;
  },
});
