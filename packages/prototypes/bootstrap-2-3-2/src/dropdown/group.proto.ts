import { definePrototype } from '@proto.ui/core';
import { asDropdownGroup, type DropdownGroupProps } from '@proto.ui/prototypes-base/dropdown';
export default definePrototype<DropdownGroupProps>({
  name: 'bootstrap-2-3-2-dropdown-group',
  modules: asDropdownGroup.modules,
  setup() {
    // A semantic grouping owner; historical menus add no group chrome.
    return asDropdownGroup().render;
  },
});
