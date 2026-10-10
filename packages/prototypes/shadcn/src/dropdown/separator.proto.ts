import { definePrototype, tw } from '@proto.ui/core';
import {
  asDropdownSeparator,
  type DropdownSeparatorProps,
} from '@proto.ui/prototypes-base/dropdown';
export default definePrototype<DropdownSeparatorProps>({
  name: 'shadcn-dropdown-separator',
  setup(def) {
    asDropdownSeparator();
    def.feedback.style.use(tw('-mx-1 my-1 h-px bg-border'));
  },
});
