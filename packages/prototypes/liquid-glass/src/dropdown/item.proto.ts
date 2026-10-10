import { definePrototype, tw } from '@proto.ui/core';
import {
  asDropdownItem,
  type DropdownItemProps,
  type DropdownItemExposes,
} from '@proto.ui/prototypes-base/dropdown';
export default definePrototype<DropdownItemProps, DropdownItemExposes>({
  name: 'liquid-glass-dropdown-item',
  setup(def) {
    const state = asDropdownItem().stateHandles;
    if (!state) throw new Error('Dropdown Item capture missing');
    def.feedback.style.use(
      tw(
        'relative flex min-w-0 w-full items-center gap-2 rounded-lg px-3 py-2 text-sm whitespace-normal wrap-anywhere text-start cursor-default select-none outline-none'
      )
    );
    def.rule({
      when: (w) => w.any(w.state(state.hovered).eq(true), w.state(state.focused).eq(true)),
      intent: (i) => i.feedback.style.use(tw('bg-accent text-accent-foreground')),
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
