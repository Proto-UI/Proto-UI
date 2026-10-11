import { definePrototype, tw } from '@proto.ui/core';
import {
  asDropdownRoot,
  type DropdownRootProps,
  type DropdownRootExposes,
} from '@proto.ui/prototypes-base/dropdown';
export default definePrototype<DropdownRootProps, DropdownRootExposes>({
  name: 'bootstrap-2-3-2-dropdown-root',
  setup(def) {
    asDropdownRoot();
  },
});
