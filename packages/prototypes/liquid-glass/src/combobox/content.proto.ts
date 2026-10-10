import { definePrototype, tw } from '@proto.ui/core';
import {
  asComboboxContent,
  type ComboboxContentProps,
  type ComboboxContentExposes,
} from '@proto.ui/prototypes-base/combobox';
export default definePrototype<ComboboxContentProps, ComboboxContentExposes>({
  name: 'liquid-glass-combobox-content',
  setup(def) {
    const behavior = asComboboxContent();
    def.feedback.style.use(
      tw(
        'rounded-2xl border border-border bg-secondary text-secondary-foreground shadow-md z-50 min-w-0 w-[max(var(--proto-ui-anchor-width,16rem),12rem)] max-w-[var(--proto-ui-available-width,100%)] max-h-[var(--proto-ui-available-height,20rem)] overflow-y-auto p-1'
      )
    );
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('open')!).eq(true),
      intent: (i) => i.feedback.material.use({ intent: 'liquid-glass' }),
    });
  },
});
