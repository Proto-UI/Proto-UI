import type { NumberFieldStepExposes } from '@proto.ui/prototypes-base/number-field';
import type { NumberFieldPartProps } from '@proto.ui/prototypes-base/number-field';
import { definePrototype, tw } from '@proto.ui/core';
import { asNumberFieldIncrement } from '@proto.ui/prototypes-base/number-field';
export default definePrototype<NumberFieldPartProps, NumberFieldStepExposes>({
  name: 'bootstrap-2-3-2-number-field-increment',
  setup(def) {
    const inherited = asNumberFieldIncrement();
    def.feedback.style.use(
      tw(
        'inline-flex min-h-8 min-w-8 items-center justify-center rounded-[4px] border border-border bg-background p-2 text-foreground outline-none'
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
