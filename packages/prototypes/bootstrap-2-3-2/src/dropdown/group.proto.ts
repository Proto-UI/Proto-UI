import { definePrototype, tw } from '@proto.ui/core';
import { asDropdownGroup, type DropdownGroupProps } from '@proto.ui/prototypes-base/dropdown';
export default definePrototype<DropdownGroupProps>({
  name: 'bootstrap-2-3-2-dropdown-group',
  setup(def) {
    asDropdownGroup();
  },
});
