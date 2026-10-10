import type { NumberFieldPartProps } from '@proto.ui/prototypes-base/number-field';
import { definePrototype, tw } from '@proto.ui/core';
import { asNumberFieldIncrement } from '@proto.ui/prototypes-base/number-field';
export default definePrototype<NumberFieldPartProps, Record<string, unknown>>({
  name: 'liquid-glass-number-field-increment',
  setup(def) {
    const inherited = asNumberFieldIncrement();
    def.feedback.style.use(
      tw(
        'inline-flex min-h-11 min-w-10 items-center justify-center rounded-2xl border border-border bg-background p-2 text-foreground outline-none'
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
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.feedback.material.use({ intent: 'liquid-glass' });
    return inherited.render;
  },
});
