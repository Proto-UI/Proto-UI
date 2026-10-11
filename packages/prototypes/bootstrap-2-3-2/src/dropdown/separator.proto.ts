import { definePrototype, tw } from '@proto.ui/core';
import {
  asDropdownSeparator,
  type DropdownSeparatorProps,
} from '@proto.ui/prototypes-base/dropdown';
export default definePrototype<DropdownSeparatorProps>({
  name: 'bootstrap-2-3-2-dropdown-separator',
  setup(def) {
    asDropdownSeparator();
    def.feedback.style.use(tw('mx-px my-[0.5625rem] h-px bg-border'));
  },
});
