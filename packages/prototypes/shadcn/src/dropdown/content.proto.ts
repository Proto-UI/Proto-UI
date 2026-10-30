import { definePrototype } from '@proto.ui/core';
import { asDropdownContent } from '@proto.ui/prototypes-base/dropdown';
import type { ShadcnDropdownContentExposes, ShadcnDropdownContentProps } from './types';
import { setupMenuSurface, setupMenuOpenPaint } from './visual';

const dropdownContent = definePrototype<ShadcnDropdownContentProps, ShadcnDropdownContentExposes>({
  name: 'shadcn-dropdown-content',
  modules: asDropdownContent.modules,
  setup(def) {
    // P-SHADCN-DROPDOWN-MENU-CONTENT-BASE-INHERITANCE,
    // P-SHADCN-DROPDOWN-MENU-CONTENT-CURRENT-BASE-DEVIATIONS
    const dropdown = asDropdownContent();
    // P-SHADCN-DROPDOWN-MENU-CONTENT-TRANSITION
    dropdown.asTransition.configure({ enterDuration: 100, leaveDuration: 100 });
    const { open } = dropdown.stateHandles;
    setupMenuSurface(def, 'dropdown');
    setupMenuOpenPaint(def, open, true);
  },
});

/** P-SHADCN-DROPDOWN-MENU-CONTENT-DIRECT-ENTRY; parity is bounded by P-SHADCN-DROPDOWN-MENU-CONTENT-COMPATIBILITY-SUBSET. */

export default dropdownContent;
