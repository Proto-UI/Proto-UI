import { definePrototype, tw } from '@proto.ui/core';
import {
  asComboboxItem,
  type ComboboxItemProps,
  type ComboboxItemExposes,
} from '@proto.ui/prototypes-base/combobox';
export default definePrototype<ComboboxItemProps, ComboboxItemExposes>({
  name: 'brutalist-combobox-item',
  modules: asComboboxItem.modules,
  setup(def) {
    const behavior = asComboboxItem();
    def.feedback.style.use(
      tw(
        'font-sans font-medium flex min-w-0 cursor-default select-none items-center rounded-base border-2 border-transparent px-3 py-2 text-sm break-words'
      )
    );
    def.rule({
      when: (w) => w.state(behavior.getState!('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed pointer-events-none')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(behavior.getState!('active')!).eq(true),
          w.state(behavior.getState!('disabled')!).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-accent text-accent-foreground border-black')),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('selected')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('font-bold')),
    });
    return behavior.render;
  },
});
