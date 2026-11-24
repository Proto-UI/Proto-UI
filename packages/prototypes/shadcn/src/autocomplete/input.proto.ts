import { definePrototype, tw } from '@proto.ui/core';
import { asAutocompleteInput } from '@proto.ui/prototypes-base/autocomplete';
import type { AutocompleteInputProps, AutocompleteInputExposes } from './types';
import { setupSearchInputPaint } from '../combobox/visual';

export default definePrototype<AutocompleteInputProps, AutocompleteInputExposes>({
  name: 'shadcn-autocomplete-input',
  modules: asAutocompleteInput.modules,
  setup(def) {
    const behavior = asAutocompleteInput();
    const disabled = behavior.getState!('disabled')!;
    const focusVisible = behavior.getState!('focusVisible')!;
    def.props.define({
      size: { type: 'enum', empty: 'fallback', options: ['sm', 'default', 'lg'] },
      invalid: { type: 'boolean', empty: 'fallback' },
    });
    def.props.setDefaults({ size: 'default', invalid: false });
    setupSearchInputPaint(def, {
      disabled,
      focusVisible,
    });
    def.feedback.style.use(tw('flex-1'));
    def.rule({
      when: (w) => w.prop('size').eq('sm'),
      intent: (i) => i.feedback.style.use(tw('h-7 px-2 text-xs')),
    });
    def.rule({
      when: (w) => w.prop('size').eq('lg'),
      intent: (i) => i.feedback.style.use(tw('h-10 px-3.5 text-sm')),
    });
    def.rule({
      when: (w) => w.prop('invalid').eq(true),
      intent: (i) => i.feedback.style.use(tw('border-destructive ring-destructive/20')),
    });
    def.rule({
      when: (w) => w.all(w.prop('invalid').eq(true), w.state(focusVisible).eq(true)),
      intent: (i) => i.feedback.style.use(tw('border-destructive ring-3 ring-destructive/30')),
    });
    def.rule({
      when: (w) => w.not(w.meta('preference.reducedMotion').eq('no-preference')),
      intent: (i) => i.feedback.style.use(tw('transition-none')),
    });
    return () => null;
  },
});
