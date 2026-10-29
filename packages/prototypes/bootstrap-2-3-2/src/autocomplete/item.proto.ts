import { definePrototype, tw } from '@proto.ui/core';
import {
  asAutocompleteItem,
  type AutocompleteItemProps,
  type AutocompleteItemExposes,
} from '@proto.ui/prototypes-base/autocomplete';
export default definePrototype<AutocompleteItemProps, AutocompleteItemExposes>({
  name: 'bootstrap-2-3-2-autocomplete-item',
  modules: asAutocompleteItem.modules,
  setup(def) {
    const behavior = asAutocompleteItem();
    def.feedback.style.use(
      tw(
        'block min-w-0 cursor-pointer select-none px-[20px] py-[3px] text-[14px] font-normal leading-[20px] text-foreground whitespace-nowrap'
      )
    );
    def.rule({
      when: (w) => w.state(behavior.getState!('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('text-[#999] cursor-default')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(behavior.getState!('active')!).eq(true),
          w.state(behavior.getState!('disabled')!).eq(false)
        ),
      intent: (i) =>
        i.feedback.style.use(tw('bg-[linear-gradient(#08c,#0077b3)] text-primary-foreground')),
    });
    return behavior.render;
  },
});
