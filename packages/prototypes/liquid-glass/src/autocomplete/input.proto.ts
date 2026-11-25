import { definePrototype, tw } from '@proto.ui/core';
import {
  asAutocompleteInput,
  type AutocompleteInputProps as BaseAutocompleteInputProps,
  type AutocompleteInputExposes,
} from '@proto.ui/prototypes-base/autocomplete';
import { COMMAND_FOCUS } from '../interactive-surface';

export type AutocompleteInputProps = BaseAutocompleteInputProps & {
  /** Auto enhances only when live preference/support inputs are affirmative. */
  material?: 'auto' | 'opaque';
};

export default definePrototype<AutocompleteInputProps, AutocompleteInputExposes>({
  name: 'liquid-glass-autocomplete-input',
  modules: asAutocompleteInput.modules,
  setup(def) {
    def.props.define({
      material: { type: 'enum', empty: 'fallback', options: ['auto', 'opaque'] },
    });
    def.props.setDefaults({ material: 'auto' });
    const behavior = asAutocompleteInput();
    const disabled = behavior.getState!('disabled')!;
    def.feedback.style.use(
      tw(
        'rounded-xl border border-border min-w-0 flex-1 bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground'
      )
    );
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.rule({
      when: (w) => w.all(w.prop('material').eq('auto'), w.state(disabled).eq(false)),
      intent: (i) => i.feedback.material.use({ intent: 'liquid-glass' }),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw('bg-muted text-muted-foreground border-border/50 cursor-not-allowed shadow-none')
        ),
    });
    return behavior.render;
  },
});
