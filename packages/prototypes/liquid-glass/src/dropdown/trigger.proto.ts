import { definePrototype, tw } from '@proto.ui/core';
import {
  asDropdownTrigger,
  type DropdownTriggerProps,
  type DropdownTriggerExposes,
} from '@proto.ui/prototypes-base/dropdown';
export default definePrototype<DropdownTriggerProps, DropdownTriggerExposes>({
  name: 'liquid-glass-dropdown-trigger',
  setup(def) {
    const state = asDropdownTrigger().stateHandles;
    if (!state) throw new Error('Dropdown Trigger capture missing');
    def.feedback.style.use(
      tw(
        'inline-flex min-w-0 items-center justify-center gap-2 rounded-full border border-border bg-secondary text-secondary-foreground px-5 py-2 text-sm font-medium select-none shadow-sm'
      )
    );
    def.rule({
      when: (w) => w.any(w.state(state.hovered).eq(true), w.state(state.focused).eq(true)),
      intent: (i) => i.feedback.style.use(tw('shadow-md')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-ring ring-inset')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50')),
    });
  },
});
