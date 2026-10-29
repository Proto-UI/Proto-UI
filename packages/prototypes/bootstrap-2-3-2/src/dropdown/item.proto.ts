import { definePrototype, tw } from '@proto.ui/core';
import {
  asDropdownItem,
  type DropdownItemProps,
  type DropdownItemExposes,
} from '@proto.ui/prototypes-base/dropdown';
export default definePrototype<DropdownItemProps, DropdownItemExposes>({
  name: 'bootstrap-2-3-2-dropdown-item',
  modules: asDropdownItem.modules,
  setup(def) {
    const behavior = asDropdownItem();
    const state = behavior.stateHandles;
    if (!state) throw new Error('Dropdown Item capture missing');
    def.feedback.style.use(
      tw(
        'relative flex min-w-0 w-full items-center gap-[8px] px-[20px] py-[3px] text-[14px] font-normal leading-[20px] text-foreground whitespace-nowrap text-start cursor-pointer select-none'
      )
    );
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.disabled).eq(false),
          w.any(
            w.state(state.hovered).eq(true),
            w.state(state.focused).eq(true),
            w.state(state.active).eq(true)
          )
        ),
      intent: (i) =>
        i.feedback.style.use(tw('bg-[linear-gradient(#08c,#0077b3)] text-primary-foreground')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-ring ring-inset')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('text-[#999] cursor-default')),
    });
    return behavior.render;
  },
});
