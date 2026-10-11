import { definePrototype, tw } from '@proto.ui/core';
import { asDropdownLabel, type DropdownLabelProps } from '@proto.ui/prototypes-base/dropdown';
export default definePrototype<DropdownLabelProps>({
  name: 'brutalist-dropdown-label',
  setup(def) {
    asDropdownLabel();
    def.feedback.style.use(tw('px-2 py-1.5 text-sm font-heading font-bold'));
  },
});
