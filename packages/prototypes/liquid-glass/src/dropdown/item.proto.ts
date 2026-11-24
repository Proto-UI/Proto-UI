import { definePrototype, tw } from '@proto.ui/core';
import { COMMAND_DISABLED_FOCUSABLE, COMMAND_FOCUS_INSET } from '../interactive-surface';
import {
  asDropdownItem,
  type DropdownItemProps as BaseDropdownItemProps,
  type DropdownItemExposes,
} from '@proto.ui/prototypes-base/dropdown';

export interface DropdownItemProps extends BaseDropdownItemProps {
  inset?: boolean;
  variant?: 'default' | 'destructive';
}

export default definePrototype<DropdownItemProps, DropdownItemExposes>({
  name: 'liquid-glass-dropdown-item',
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
        'relative flex min-w-0 w-full items-center gap-2 rounded-lg px-3 py-2 text-sm whitespace-normal wrap-anywhere text-start cursor-default select-none outline-none'
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
      intent: (i) => i.feedback.style.use(tw('bg-accent text-accent-foreground')),
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
      intent: (i) => i.feedback.style.use(tw('bg-destructive/10 text-destructive')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.disabled).eq(false),
          w.prop('variant').eq('destructive'),
          w.meta('colorScheme').eq('dark'),
          w.any(
            w.state(state.hovered).eq(true),
            w.state(state.focused).eq(true),
            w.state(state.active).eq(true)
          )
        ),
      intent: (i) => i.feedback.style.use(tw('bg-destructive/20')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS_INSET)),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(`text-muted-foreground ${COMMAND_DISABLED_FOCUSABLE}`)),
    });
    return behavior.render;
  },
});
