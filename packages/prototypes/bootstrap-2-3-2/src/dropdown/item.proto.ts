import { definePrototype, tw } from '@proto.ui/core';
import {
  asDropdownItem,
  type DropdownItemProps,
  type DropdownItemExposes,
} from '@proto.ui/prototypes-base/dropdown';
export default definePrototype<DropdownItemProps, DropdownItemExposes>({
  name: 'bootstrap-2-3-2-dropdown-item',
  setup(def) {
    const state = asDropdownItem().stateHandles;
    if (!state) throw new Error('Dropdown Item capture missing');
    def.feedback.style.use(
      tw(
        'relative flex min-w-0 w-full items-center gap-2 px-5 py-[0.1875rem] text-sm font-normal leading-5 whitespace-normal wrap-anywhere text-start cursor-default select-none outline-none'
      )
    );
    def.rule({
      when: (w) => w.any(w.state(state.hovered).eq(true), w.state(state.focused).eq(true)),
      intent: (i) =>
        i.feedback.style.use(tw('bg-[linear-gradient(#0077b3,#005580)] text-primary-foreground')),
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
