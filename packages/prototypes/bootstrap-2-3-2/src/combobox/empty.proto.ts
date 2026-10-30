import { definePrototype, tw } from '@proto.ui/core';
import {
  asComboboxEmpty,
  type ComboboxEmptyProps,
  type ComboboxEmptyExposes,
} from '@proto.ui/prototypes-base/combobox';
export default definePrototype<ComboboxEmptyProps, ComboboxEmptyExposes>({
  name: 'bootstrap-2-3-2-combobox-empty',
  modules: asComboboxEmpty.modules,
  setup(def) {
    const behavior = asComboboxEmpty();
    def.feedback.style.use(tw('px-[20px] py-[3px] text-[14px] leading-[20px] text-[#999]'));
    return behavior.render;
  },
});
