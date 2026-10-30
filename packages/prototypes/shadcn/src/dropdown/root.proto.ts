import { definePrototype } from '@proto.ui/core';
import { asDropdownRoot } from '@proto.ui/prototypes-base/dropdown';
import type { ShadcnDropdownRootExposes, ShadcnDropdownRootProps } from './types';
import { setupShadcnStyleScope } from '../style-scope';

const dropdownRoot = definePrototype<ShadcnDropdownRootProps, ShadcnDropdownRootExposes>({
  name: 'shadcn-dropdown-root',
  modules: asDropdownRoot.modules,
  setup(def) {
    // P-SHADCN-DROPDOWN-MENU-BASE-INHERITANCE,
    // P-SHADCN-DROPDOWN-MENU-CURRENT-BASE-DEVIATIONS
    asDropdownRoot();
    // Semantic-only Root transports selection without imposing a visual default
    // on parts whose independently adopted compatibility sources differ.
    setupShadcnStyleScope(def);
  },
});

/** P-SHADCN-DROPDOWN-MENU-DIRECT-ENTRY; parity is bounded by P-SHADCN-DROPDOWN-MENU-COMPATIBILITY-SUBSET. */

export default dropdownRoot;
