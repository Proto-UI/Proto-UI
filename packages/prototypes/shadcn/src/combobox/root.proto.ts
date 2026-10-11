import { definePrototype, tw } from '@proto.ui/core';
import {
  asComboboxRoot,
  type ComboboxRootProps,
  type ComboboxRootExposes,
} from '@proto.ui/prototypes-base/combobox';
export default definePrototype<ComboboxRootProps, ComboboxRootExposes>({
  name: 'shadcn-combobox-root',
  setup(def) {
    const behavior = asComboboxRoot();
    def.feedback.style.use(tw('relative flex min-w-0 w-full max-w-md flex-wrap gap-2'));
  },
});
