import type {
  CheckboxGroupItemProps,
  CheckboxGroupItemExposes,
} from '@proto.ui/prototypes-base/checkbox-group';
import { definePrototype, tw } from '@proto.ui/core';
import { asCheckboxGroupAll } from '@proto.ui/prototypes-base/checkbox-group';
export default definePrototype<CheckboxGroupItemProps, CheckboxGroupItemExposes>({
  name: 'liquid-glass-checkbox-group-all',
  setup(def) {
    const inherited = asCheckboxGroupAll();
    def.feedback.style.use(
      tw(
        'inline-flex min-h-11 items-center gap-2 rounded-2xl border border-border bg-muted px-3 py-2 text-foreground outline-none'
      )
    );
    const state = inherited.stateHandles!;
    def.rule({
      when: (w) => w.state(state.checked).eq(true),
      intent: (i) => i.feedback.style.use(tw('border-primary bg-primary text-primary-foreground')),
    });
    def.rule({
      when: (w) => w.state(state.indeterminate).eq(true),
      intent: (i) => i.feedback.style.use(tw('border-primary bg-accent text-accent-foreground')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-ring ring-offset-2')),
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
