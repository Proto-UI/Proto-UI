import { definePrototype, tw } from '@proto.ui/core';
import { asDropdownGroup, type DropdownGroupProps } from '@proto.ui/prototypes-base/dropdown';
export default definePrototype<DropdownGroupProps>({
  name: 'liquid-glass-dropdown-group',
  setup(def) {
    const behavior = asDropdownGroup();
    def.feedback.style.use(tw('min-w-0 py-1 text-sm text-secondary-foreground'));
    return behavior.render;
  },
});
