import { definePrototype, tw } from '@proto.ui/core';
import {
  asAutocompleteInput,
  type AutocompleteInputProps,
  type AutocompleteInputExposes,
} from '@proto.ui/prototypes-base/autocomplete';
export default definePrototype<AutocompleteInputProps, AutocompleteInputExposes>({
  name: 'bootstrap-2-3-2-autocomplete-input',
  modules: asAutocompleteInput.modules,
  setup(def) {
    const behavior = asAutocompleteInput();
    def.feedback.style.use(
      tw(
        'inline-block box-border h-[30px] w-[220px] min-w-0 mb-[10px] rounded-[4px] border border-border px-[6px] py-[4px] text-[14px] font-normal leading-[20px] text-[#555] shadow-[inset_0_1px_1px_rgb(0_0_0/7.5%)]'
      )
    );
    // forms.less uses a 206px content box plus 12px padding and 2px border.
    def.rule({
      when: (w) => w.state(behavior.getState!('disabled')!).eq(false),
      intent: (i) => i.feedback.style.use(tw('bg-background')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(behavior.getState!('focused')!).eq(true),
          w.state(behavior.getState!('disabled')!).eq(false)
        ),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'outline-none border-[rgb(82_168_236/80%)] shadow-[inset_0_1px_1px_rgb(0_0_0/7.5%),0_0_8px_rgb(82_168_236/60%)]'
          )
        ),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-ring ring-offset-2')),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-[#eee] cursor-not-allowed')),
    });
    return behavior.render;
  },
});
