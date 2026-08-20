import { definePrototype } from '@proto.ui/core';
import { asDropdownRoot } from '@proto.ui/prototypes-base/dropdown';
import type { BrutalistDropdownRootExposes, BrutalistDropdownRootProps } from './types';

const dropdownRoot = definePrototype<BrutalistDropdownRootProps, BrutalistDropdownRootExposes>({
  name: 'brutalist-dropdown-root',
  setup(def) {
    // P-BRUTALIST-DROPDOWN-MENU-BASE-INHERITANCE
    asDropdownRoot();
  },
});

/** P-BRUTALIST-DROPDOWN-MENU-ENTRY */

export default dropdownRoot;
