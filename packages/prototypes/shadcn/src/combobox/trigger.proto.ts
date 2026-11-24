import { definePrototype } from '@proto.ui/core';
import { asComboboxTrigger } from '@proto.ui/prototypes-base/combobox';
import type { ComboboxTriggerProps, ComboboxTriggerExposes } from './types';
import { setupSearchTriggerPaint } from './visual';
export default definePrototype<ComboboxTriggerProps, ComboboxTriggerExposes>({
  name: 'shadcn-combobox-trigger',
  modules: asComboboxTrigger.modules,
  setup(def) {
    const behavior = asComboboxTrigger();
    setupSearchTriggerPaint(def, {
      disabled: behavior.getState!('disabled')!,
      focused: behavior.getState!('focused')!,
      focusVisible: behavior.getState!('focusVisible')!,
    });
    return behavior.render;
  },
});
