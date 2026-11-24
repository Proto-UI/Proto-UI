import { definePrototype, tw } from '@proto.ui/core';
import {
  asComboboxContent,
  type ComboboxContentProps as BaseComboboxContentProps,
  type ComboboxContentExposes,
} from '@proto.ui/prototypes-base/combobox';

export type ComboboxContentProps = BaseComboboxContentProps & {
  material?: 'auto' | 'opaque';
};

export default definePrototype<ComboboxContentProps, ComboboxContentExposes>({
  name: 'liquid-glass-combobox-content',
  modules: asComboboxContent.modules,
  setup(def) {
    const behavior = asComboboxContent();
    def.props.define({
      material: { type: 'enum', empty: 'fallback', options: ['auto', 'opaque'] },
    });
    def.props.setDefaults({ material: 'auto' });
    def.feedback.style.use(
      tw(
        'font-sans rounded-2xl border border-border ring-1 ring-inset ring-border bg-secondary text-secondary-foreground shadow-lg z-50 min-w-0 w-[max(var(--proto-ui-anchor-width,16rem),12rem)] max-w-[var(--proto-ui-available-width,100%)] max-h-[var(--proto-ui-available-height,20rem)] overflow-y-auto p-1'
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
      when: (w) => w.meta('preference.reducedMotion').eq('reduce'),
      intent: (i) => i.feedback.style.use(tw('duration-0')),
    });
    return behavior.render;
  },
});
