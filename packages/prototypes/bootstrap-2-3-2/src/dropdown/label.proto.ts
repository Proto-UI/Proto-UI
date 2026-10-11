import { definePrototype, tw } from '@proto.ui/core';
import { asDropdownLabel, type DropdownLabelProps } from '@proto.ui/prototypes-base/dropdown';
export default definePrototype<DropdownLabelProps>({
  name: 'bootstrap-2-3-2-dropdown-label',
  setup(def) {
    asDropdownLabel();
    def.feedback.style.use(
      tw('px-5 py-[0.1875rem] text-[0.6875rem] font-bold leading-5 text-muted-foreground uppercase')
    );
  },
});
