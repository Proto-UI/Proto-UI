import type { NumberFieldPartProps } from '@proto.ui/prototypes-base/number-field';
import { definePrototype, tw } from '@proto.ui/core';
import { asNumberFieldInput } from '@proto.ui/prototypes-base/number-field';
export default definePrototype<NumberFieldPartProps, Record<string, unknown>>({
  name: 'brutalist-number-field-input',
  modules: asNumberFieldInput.modules,
  setup(def) {
    const inherited = asNumberFieldInput();
    def.feedback.style.use(
      tw(
        'block min-h-10 min-w-0 flex-1 rounded-none border-2 border border-border bg-background shadow-[2px_2px_0_0_var(--pui-border)] px-3 py-2 text-base tabular-nums text-foreground outline-none'
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
