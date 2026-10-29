import { definePrototype } from '@proto.ui/core';
import { asComboboxInput } from '@proto.ui/prototypes-base/combobox';
import type { ComboboxInputProps, ComboboxInputExposes } from './types';
import { setupSearchInputPaint } from './visual';
export default definePrototype<ComboboxInputProps, ComboboxInputExposes>({
  name: 'shadcn-combobox-input',
  modules: asComboboxInput.modules,
  setup(def) {
    const behavior = asComboboxInput();
    setupSearchInputPaint(def, {
      disabled: behavior.getState!('disabled')!,
      focusVisible: behavior.getState!('focusVisible')!,
    });
    return () => null;
  },
});
