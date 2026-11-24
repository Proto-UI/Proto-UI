import { definePrototype, tw } from '@proto.ui/core';
import {
  type MeterPartProps,
  type MeterPartExposes,
  asMeterIndicator,
} from '@proto.ui/prototypes-base/meter';
export default definePrototype<MeterPartProps, MeterPartExposes>({
  name: 'brutalist-meter-indicator',
  modules: asMeterIndicator.modules,
  setup(def) {
    const inherited = asMeterIndicator();
    const status = inherited.stateHandles!.status;
    def.feedback.style.use(tw('block h-full w-[calc(var(--pui-percentage)*1%)]'));
    def.rule({
      when: (w) => w.not(w.any(w.state(status).eq('suboptimal'), w.state(status).eq('critical'))),
      intent: (i) => i.feedback.style.use(tw('bg-primary')),
    });
    def.rule({
      when: (w) => w.state(status).eq('suboptimal'),
      intent: (i) => i.feedback.style.use(tw('bg-canary')),
    });
    def.rule({
      when: (w) => w.state(status).eq('critical'),
      intent: (i) => i.feedback.style.use(tw('bg-destructive')),
    });
    return inherited.render;
  },
});
