import { definePrototype, tw } from '@proto.ui/core';
import {
  asDropdownRoot,
  type DropdownRootProps,
  type DropdownRootExposes,
} from '@proto.ui/prototypes-base/dropdown';
export default definePrototype<DropdownRootProps, DropdownRootExposes>({
  name: 'bootstrap-2-3-2-dropdown-root',
  modules: asDropdownRoot.modules,
  setup(def) {
    const behavior = asDropdownRoot();
    def.feedback.style.use(tw('relative inline-block'));
    return behavior.render;
  },
});
