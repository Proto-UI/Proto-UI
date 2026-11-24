import type { FieldsetPartProps, FieldsetRootExposes } from '@proto.ui/prototypes-base/fieldset';
import { definePrototype, tw } from '@proto.ui/core';
import { asFieldsetLegend } from '@proto.ui/prototypes-base/fieldset';

export default definePrototype<FieldsetPartProps, FieldsetRootExposes>({
  name: 'bootstrap-2-3-2-fieldset-legend',
  modules: asFieldsetLegend.modules,
  setup(def) {
    const inherited = asFieldsetLegend();
    def.feedback.style.use(
      tw(
        'block w-full m-0 mb-[20px] p-0 border-0 border-b border-border text-[21px] font-normal leading-[40px] text-foreground'
      )
    );
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50')),
    });
    return inherited.render;
  },
});
