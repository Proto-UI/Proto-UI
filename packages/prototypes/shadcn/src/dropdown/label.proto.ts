import { definePrototype, tw } from '@proto.ui/core';
import { asDropdownLabel, type DropdownLabelProps } from '@proto.ui/prototypes-base/dropdown';
export default definePrototype<DropdownLabelProps>({
  name: 'shadcn-dropdown-label',
  setup(def) {
    asDropdownLabel();
    def.feedback.style.use(tw('px-1.5 py-1 text-xs font-medium text-muted-foreground'));
  },
});
