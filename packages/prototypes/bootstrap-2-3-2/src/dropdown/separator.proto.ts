import { definePrototype, tw } from '@proto.ui/core';
import {
  asDropdownSeparator,
  type DropdownSeparatorProps,
} from '@proto.ui/prototypes-base/dropdown';
export default definePrototype<DropdownSeparatorProps>({
  name: 'bootstrap-2-3-2-dropdown-separator',
  modules: asDropdownSeparator.modules,
  setup(def) {
    const behavior = asDropdownSeparator();
    def.feedback.style.use(
      tw('mx-[1px] my-[9px] h-[1px] overflow-hidden bg-[#e5e5e5] border-b border-b-[#fff]')
    );
    return behavior.render;
  },
});
