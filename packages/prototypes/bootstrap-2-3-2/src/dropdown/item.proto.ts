import { definePrototype, tw } from '@proto.ui/core';
import {
  asDropdownItem,
  type DropdownItemProps as BaseDropdownItemProps,
  type DropdownItemExposes,
} from '@proto.ui/prototypes-base/dropdown';

export interface BootstrapDropdownItemProps extends BaseDropdownItemProps {
  inset?: boolean;
  variant?: 'default' | 'destructive';
}

export default definePrototype<BootstrapDropdownItemProps, DropdownItemExposes>({
  name: 'bootstrap-2-3-2-dropdown-item',
  modules: asDropdownItem.modules,
  setup(def) {
    def.props.define({
      inset: { type: 'boolean', empty: 'fallback' },
      variant: { type: 'enum', empty: 'fallback', options: ['default', 'destructive'] },
    });
    def.props.setDefaults({ inset: false, variant: 'default' });
    const behavior = asDropdownItem();
    const state = behavior.stateHandles;
    if (!state) throw new Error('Dropdown Item capture missing');
    def.feedback.style.use(
      tw(
        'relative flex min-w-0 w-full items-center gap-[8px] px-[20px] py-[3px] text-[14px] font-normal leading-[20px] text-foreground whitespace-nowrap text-start cursor-pointer select-none'
      )
    );
    def.rule({
      when: (w) => w.prop('inset').eq(true),
      intent: (i) => i.feedback.style.use(tw('pl-9')),
    });
    def.rule({
      when: (w) => w.all(w.state(state.disabled).eq(false), w.prop('variant').eq('destructive')),
      intent: (i) => i.feedback.style.use(tw('text-destructive')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.disabled).eq(false),
          w.prop('variant').eq('default'),
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
      when: (w) =>
        w.all(
          w.state(state.disabled).eq(false),
          w.prop('variant').eq('destructive'),
          w.any(
            w.state(state.hovered).eq(true),
            w.state(state.focused).eq(true),
            w.state(state.active).eq(true)
          )
        ),
      intent: (i) =>
        i.feedback.style.use(
          tw('bg-[#da4f49_linear-gradient(#ee5f5b,#bd362f)_0_0_repeat-x] text-primary-foreground')
        ),
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
