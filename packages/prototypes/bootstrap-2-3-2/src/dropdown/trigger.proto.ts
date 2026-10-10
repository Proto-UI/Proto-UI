import { definePrototype, tw } from '@proto.ui/core';
import {
  asDropdownTrigger,
  type DropdownTriggerProps,
  type DropdownTriggerExposes,
} from '@proto.ui/prototypes-base/dropdown';
export default definePrototype<DropdownTriggerProps, DropdownTriggerExposes>({
  name: 'bootstrap-2-3-2-dropdown-trigger',
  setup(def) {
    const state = asDropdownTrigger().stateHandles;
    if (!state) throw new Error('Dropdown Trigger capture missing');
    def.feedback.style.use(
      tw(
        'inline-flex min-w-0 items-center justify-center gap-2 rounded-[4px] border border-border bg-[linear-gradient(#fff,#e6e6e6)] text-foreground px-3 py-1 text-sm leading-5 select-none shadow-[inset_0_1px_0_rgb(255_255_255/20%),0_1px_2px_rgb(0_0_0/5%)]'
      )
    );
    def.rule({
      when: (w) => w.any(w.state(state.hovered).eq(true), w.state(state.focused).eq(true)),
      intent: (i) => i.feedback.style.use(tw('bg-[#e6e6e6]')),
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
