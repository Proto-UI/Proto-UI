import { definePrototype, tw } from '@proto.ui/core';
import {
  type MeterPartProps,
  type MeterPartExposes,
  asMeterIndicator,
} from '@proto.ui/prototypes-base/meter';
export default definePrototype<MeterPartProps, MeterPartExposes>({
  name: 'bootstrap-2-3-2-meter-indicator',
  modules: asMeterIndicator.modules,
  setup(def) {
    const inherited = asMeterIndicator();
    def.feedback.style.use(
      tw(
        'block float-left h-full box-border w-[calc(var(--pui-percentage)*1%)] text-[12px] text-center text-paint-[#fff_0_-1px_0_rgb(0_0_0/25%)] shadow-[inset_0_-1px_0_rgb(0_0_0/15%)]'
      )
    );
    // Public Base zones select the source's success/warning/danger paints;
    // these are mutually exclusive and introduce no threshold/value owner.
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.status).eq('optimal'),
      intent: (i) =>
        i.feedback.style.use(tw('bg-[#5eb95e_linear-gradient(#62c462,#57a957)_0_0_repeat-x]')),
    });
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.status).eq('suboptimal'),
      intent: (i) =>
        i.feedback.style.use(tw('bg-[#faa732_linear-gradient(#fbb450,#f89406)_0_0_repeat-x]')),
    });
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.status).eq('critical'),
      intent: (i) =>
        i.feedback.style.use(tw('bg-[#dd514c_linear-gradient(#ee5f5b,#c43c35)_0_0_repeat-x]')),
    });
    return inherited.render;
  },
});
