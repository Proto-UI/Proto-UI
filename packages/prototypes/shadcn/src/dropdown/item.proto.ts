import { definePrototype } from '@proto.ui/core';
import { asDropdownItem } from '@proto.ui/prototypes-base/dropdown';
import type { ShadcnDropdownItemExposes, ShadcnDropdownItemProps } from './types';
import { setupMenuItemPaint } from './visual';

const dropdownItem = definePrototype<ShadcnDropdownItemProps, ShadcnDropdownItemExposes>({
  name: 'shadcn-dropdown-item',
  modules: asDropdownItem.modules,
  setup(def) {
    const itemState = asDropdownItem().stateHandles;
    if (!itemState) {
      throw new Error('[shadcn-dropdown-item] Dropdown Item must project command states.');
    }
    setupMenuItemPaint(def, itemState, 'dropdown');
  },
});

/** P-SHADCN-DROPDOWN-MENU-ITEM-DIRECT-ENTRY; parity is bounded by P-SHADCN-DROPDOWN-MENU-ITEM-COMPATIBILITY-SUBSET. */

export default dropdownItem;
