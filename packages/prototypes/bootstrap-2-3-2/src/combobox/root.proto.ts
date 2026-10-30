import { definePrototype, tw } from '@proto.ui/core';
import {
  asComboboxRoot,
  type ComboboxRootProps,
  type ComboboxRootExposes,
} from '@proto.ui/prototypes-base/combobox';
export default definePrototype<ComboboxRootProps, ComboboxRootExposes>({
  name: 'bootstrap-2-3-2-combobox-root',
  modules: asComboboxRoot.modules,
  setup(def) {
    const behavior = asComboboxRoot();
    def.feedback.style.use(tw('relative inline-flex min-w-0 items-start'));
    return behavior.render;
  },
});
