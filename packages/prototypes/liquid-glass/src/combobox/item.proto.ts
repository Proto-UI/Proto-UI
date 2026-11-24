import { definePrototype, tw } from '@proto.ui/core';
import {
  asComboboxItem,
  type ComboboxItemProps,
  type ComboboxItemExposes,
} from '@proto.ui/prototypes-base/combobox';
export default definePrototype<ComboboxItemProps, ComboboxItemExposes>({
  name: 'liquid-glass-combobox-item',
  modules: asComboboxItem.modules,
  setup(def) {
    const behavior = asComboboxItem();
    const disabled = behavior.getState!('disabled')!;
    const active = behavior.getState!('active')!;
    const selected = behavior.getState!('selected')!;
    def.feedback.style.use(
      tw(
        'font-sans flex min-w-0 cursor-default select-none items-center rounded-xl px-3 py-2 text-sm break-words transition-colors'
      )
    );
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('text-muted-foreground cursor-not-allowed')),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(selected).eq(true), w.state(active).eq(false), w.state(disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('font-semibold bg-muted text-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(selected).eq(true), w.state(active).eq(true), w.state(disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('font-semibold')),
    });
    def.rule({
      when: (w) => w.all(w.state(active).eq(true), w.state(disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
    });
    def.rule({
      when: (w) => w.meta('preference.reducedMotion').eq('reduce'),
      intent: (i) => i.feedback.style.use(tw('duration-0')),
    });
    return behavior.render;
  },
});
