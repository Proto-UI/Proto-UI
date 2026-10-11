import { definePrototype, tw } from '@proto.ui/core';
import {
  asComboboxItem,
  type ComboboxItemProps,
  type ComboboxItemExposes,
} from '@proto.ui/prototypes-base/combobox';
export default definePrototype<ComboboxItemProps, ComboboxItemExposes>({
  name: 'brutalist-combobox-item',
  setup(def) {
    const behavior = asComboboxItem();
    def.feedback.style.use(
      tw(
        'flex min-w-0 cursor-default select-none items-center rounded-sm px-3 py-2 text-sm break-words'
      )
    );
    def.rule({
      when: (w) => w.state(behavior.getState!('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed')),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('active')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('selected')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('font-semibold')),
    });
  },
});
