import { definePrototype, tw } from '@proto.ui/core';
import {
  asRadioGroupItem,
  type RadioGroupItemProps,
  type RadioGroupItemExposes,
} from '@proto.ui/prototypes-base/radio-group';

// Independently expressed Bootstrap 2.3.2 design-language projection.
// Base retains all semantics; source attribution: ../../THIRD_PARTY_NOTICES.md.
// The Item is the labeled row: its accessible name comes from authored content,
// and the Indicator part renders the radio circle inside it.
export default definePrototype<RadioGroupItemProps, RadioGroupItemExposes>({
  name: 'bootstrap-2-3-2-radio-group-item',
  setup(def) {
    const inherited = asRadioGroupItem();
    const state = inherited.stateHandles;
    if (!state) {
      throw new Error('[bootstrap-2-3-2-radio-group-item] Base Item state handles required.');
    }
    def.feedback.style.use(
      tw(
        'inline-flex min-h-6 min-w-0 items-center gap-2 font-normal text-sm leading-5 text-foreground outline-none cursor-pointer'
      )
    );
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-65 cursor-not-allowed')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw('forced-colors-focus-outline ring-2 ring-ring ring-offset-2 ring-offset-background')
        ),
    });
    return inherited.render;
  },
});
