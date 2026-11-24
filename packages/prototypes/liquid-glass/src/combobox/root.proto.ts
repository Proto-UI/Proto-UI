import { definePrototype, tw } from '@proto.ui/core';
import {
  asComboboxRoot,
  type ComboboxRootProps,
  type ComboboxRootExposes,
} from '@proto.ui/prototypes-base/combobox';
export default definePrototype<ComboboxRootProps, ComboboxRootExposes>({
  name: 'liquid-glass-combobox-root',
  modules: asComboboxRoot.modules,
  setup(def) {
    const behavior = asComboboxRoot();
    def.feedback.style.use(tw('relative flex min-w-0 w-full max-w-md items-center gap-2'));
    return behavior.render;
  },
});
