import { definePrototype, tw } from '@proto.ui/core';
import { asCheckboxGroupAll } from '@proto.ui/prototypes-base/checkbox-group';
export default definePrototype({
  name: 'brutalist-checkbox-group-all',
  setup(def) {
    const inherited = asCheckboxGroupAll();
    def.feedback.style.use(
      tw(
        'inline-flex min-h-10 items-center gap-2 rounded-none border-2 border border-border bg-muted px-3 py-2 text-foreground outline-none'
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
    return inherited.render;
  },
});
