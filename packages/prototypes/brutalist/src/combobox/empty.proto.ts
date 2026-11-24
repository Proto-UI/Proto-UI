import { definePrototype, tw } from '@proto.ui/core';
import {
  asComboboxEmpty,
  type ComboboxEmptyProps,
  type ComboboxEmptyExposes,
} from '@proto.ui/prototypes-base/combobox';
export default definePrototype<ComboboxEmptyProps, ComboboxEmptyExposes>({
  name: 'brutalist-combobox-empty',
  modules: asComboboxEmpty.modules,
  setup(def) {
    const behavior = asComboboxEmpty();
    def.feedback.style.use(
      tw('font-sans font-medium px-3 py-6 text-center text-sm text-muted-foreground')
    );
    return behavior.render;
  },
});
