import { definePrototype, tw } from '@proto.ui/core';
import { asComboboxInput } from '@proto.ui/prototypes-base/combobox';
import type { ComboboxInputProps, ComboboxInputExposes } from './types';
import { setupSearchInputPaint } from './visual';
export default definePrototype<ComboboxInputProps, ComboboxInputExposes>({
  name: 'shadcn-combobox-input',
  modules: asComboboxInput.modules,
  setup(def) {
    const behavior = asComboboxInput();
    def.props.define({
      invalid: { type: 'boolean', empty: 'fallback' },
    });
    def.props.setDefaults({ invalid: false });
    const disabled = behavior.getState!('disabled')!;
    setupSearchInputPaint(def, {
      disabled,
      focusVisible: behavior.getState!('focusVisible')!,
    });
    def.rule({
      when: (w) => w.all(w.prop('invalid').eq(true), w.state(disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('border-destructive ring-2 ring-destructive/30')),
    });
    return () => null;
  },
});
