import { definePrototype, tw } from '@proto.ui/core';
import {
  asComboboxEmpty,
  type ComboboxEmptyProps,
  type ComboboxEmptyExposes,
} from '@proto.ui/prototypes-base/combobox';
export default definePrototype<ComboboxEmptyProps, ComboboxEmptyExposes>({
  name: 'bootstrap-2-3-2-combobox-empty',
  setup(def) {
    const behavior = asComboboxEmpty();
    def.feedback.style.use(tw('px-3 py-6 text-center text-sm text-muted-foreground'));
  },
});
