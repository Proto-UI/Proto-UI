import { definePrototype, tw } from '@proto.ui/core';
import {
  asAutocompleteContent,
  type AutocompleteContentProps,
  type AutocompleteContentExposes,
} from '@proto.ui/prototypes-base/autocomplete';

export type LiquidGlassAutocompleteContentProps = AutocompleteContentProps & {
  material?: 'auto' | 'opaque';
};

export default definePrototype<LiquidGlassAutocompleteContentProps, AutocompleteContentExposes>({
  name: 'liquid-glass-autocomplete-content',
  modules: asAutocompleteContent.modules,
  setup(def) {
    const behavior = asAutocompleteContent();
    def.props.define({
      material: { type: 'enum', empty: 'fallback', options: ['auto', 'opaque'] },
    });
    def.props.setDefaults({ material: 'auto' });

    // Concentric corner geometry: rounded-2xl (16px) outer + p-1 (4px) padding -> rounded-xl (12px) items.
    def.feedback.style.use(
      tw(
        'rounded-2xl border border-border bg-secondary text-secondary-foreground shadow-md z-50 min-w-0 w-[max(var(--proto-ui-anchor-width,16rem),12rem)] max-w-[var(--proto-ui-available-width,100%)] max-h-[var(--proto-ui-available-height,20rem)] overflow-y-auto p-1 outline-none'
      )
    );
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.rule({
      when: (w) =>
        w.all(w.state(behavior.getState!('open')!).eq(true), w.prop('material').eq('auto')),
      intent: (i) => i.feedback.material.use({ intent: 'liquid-glass' }),
    });
    def.rule({
      when: (w) => w.prop('material').eq('opaque'),
      intent: (i) => i.feedback.style.use(tw('shadow-lg')),
    });
    return behavior.render;
  },
});
