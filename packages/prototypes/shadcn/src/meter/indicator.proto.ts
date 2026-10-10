import { definePrototype, tw } from '@proto.ui/core';
import { asMeterIndicator } from '@proto.ui/prototypes-base/meter';
export default definePrototype({
  name: 'shadcn-meter-indicator',
  setup(def) {
    const inherited = asMeterIndicator();
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
