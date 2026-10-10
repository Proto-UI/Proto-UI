import type { NumberFieldPartProps } from '@proto.ui/prototypes-base/number-field';
import { definePrototype, tw } from '@proto.ui/core';
import { asNumberFieldControl } from '@proto.ui/prototypes-base/number-field';
export default definePrototype<NumberFieldPartProps, Record<string, unknown>>({
  name: 'bootstrap-2-3-2-number-field-control',
  modules: asNumberFieldControl.modules,
  setup(def) {
    const inherited = asNumberFieldControl();
    def.feedback.style.use(
      tw(
        'block min-h-8 min-w-0 flex-1 rounded-[4px] border border-border bg-background px-3 py-2 text-base tabular-nums text-foreground outline-none'
      )
    );
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-ring ring-offset-2')),
    });
    def.rule({
      when: (w) => w.state(inherited.stateHandles!.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed')),
    });
    return inherited.render;
  },
});
