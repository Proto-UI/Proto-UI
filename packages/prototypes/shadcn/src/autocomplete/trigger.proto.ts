import { definePrototype } from '@proto.ui/core';
import { asAutocompleteTrigger } from '@proto.ui/prototypes-base/autocomplete';
import type { AutocompleteTriggerProps, AutocompleteTriggerExposes } from './types';
import { setupSearchTriggerPaint } from '../combobox/visual';
export default definePrototype<AutocompleteTriggerProps, AutocompleteTriggerExposes>({
  name: 'shadcn-autocomplete-trigger',
  modules: asAutocompleteTrigger.modules,
  setup(def) {
    const behavior = asAutocompleteTrigger();
    setupSearchTriggerPaint(def, {
      disabled: behavior.getState!('disabled')!,
      focusVisible: behavior.getState!('focusVisible')!,
    });
  },
});
