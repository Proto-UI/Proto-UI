import { definePrototype } from '@proto.ui/core';
import { asDropdownGroup, type DropdownGroupProps } from '@proto.ui/prototypes-base/dropdown';
import { setupShadcnStyleScope, type ShadcnStyleProps } from '../style-scope';
export default definePrototype<DropdownGroupProps & ShadcnStyleProps>({
  name: 'shadcn-dropdown-group',
  modules: asDropdownGroup.modules,
  setup(def) {
    asDropdownGroup();
    setupShadcnStyleScope(def);
  },
});
