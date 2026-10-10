import { definePrototype, tw } from '@proto.ui/core';
import { asDropdownLabel, type DropdownLabelProps } from '@proto.ui/prototypes-base/dropdown';
export default definePrototype<DropdownLabelProps>({
  name: 'liquid-glass-dropdown-label',
  setup(def) {
    asDropdownLabel();
    def.feedback.style.use(tw('px-3 py-1 text-xs font-medium text-muted-foreground'));
  },
});
