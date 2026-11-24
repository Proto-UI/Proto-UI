import { definePrototype, tw } from '@proto.ui/core';
import {
  asDropdownLabel,
  type DropdownLabelProps as BaseDropdownLabelProps,
} from '@proto.ui/prototypes-base/dropdown';

export interface DropdownLabelProps extends BaseDropdownLabelProps {
  inset?: boolean;
}

export default definePrototype<DropdownLabelProps>({
  name: 'liquid-glass-dropdown-label',
  modules: asDropdownLabel.modules,
  setup(def) {
    def.props.define({
      inset: { type: 'boolean', empty: 'fallback' },
    });
    def.props.setDefaults({ inset: false });
    const behavior = asDropdownLabel();
    def.feedback.style.use(tw('px-3 py-1 text-xs font-medium text-muted-foreground'));
    def.rule({
      when: (w) => w.prop('inset').eq(true),
      intent: (i) => i.feedback.style.use(tw('pl-9')),
    });
    return behavior.render;
  },
});
