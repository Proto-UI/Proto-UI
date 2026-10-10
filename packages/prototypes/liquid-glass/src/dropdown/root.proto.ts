import { definePrototype, tw } from '@proto.ui/core';
import {
  asDropdownRoot,
  type DropdownRootProps,
  type DropdownRootExposes,
} from '@proto.ui/prototypes-base/dropdown';
export default definePrototype<DropdownRootProps, DropdownRootExposes>({
  name: 'liquid-glass-dropdown-root',
  setup(def) {
    asDropdownRoot();
  },
});
