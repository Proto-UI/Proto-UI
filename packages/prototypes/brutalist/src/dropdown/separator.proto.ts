import { definePrototype, tw } from '@proto.ui/core';
import {
  asDropdownSeparator,
  type DropdownSeparatorProps,
} from '@proto.ui/prototypes-base/dropdown';
export default definePrototype<DropdownSeparatorProps>({
  name: 'brutalist-dropdown-separator',
  setup(def) {
    asDropdownSeparator();
    def.feedback.style.use(tw('-mx-1 my-1 h-0.5 bg-border'));
  },
});
