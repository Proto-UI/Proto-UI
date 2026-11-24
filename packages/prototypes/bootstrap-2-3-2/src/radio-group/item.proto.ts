import { definePrototype, tw } from '@proto.ui/core';
import {
  asRadioGroupItem,
  type RadioGroupItemProps,
  type RadioGroupItemExposes,
} from '@proto.ui/prototypes-base/radio-group';

// Independently expressed Bootstrap 2.3.2 design-language projection.
// Base retains all semantics; source attribution: ../../THIRD_PARTY_NOTICES.md.
// Item works both as a compact control host (wrapping Indicator paired with an
// external Label) and as a labeled row (wrapping Indicator + caption content).
export default definePrototype<RadioGroupItemProps, RadioGroupItemExposes>({
  name: 'bootstrap-2-3-2-radio-group-item',
  modules: asRadioGroupItem.modules,
  setup(def) {
    const inherited = asRadioGroupItem();
    const state = inherited.stateHandles;
    if (!state) {
      throw new Error('[bootstrap-2-3-2-radio-group-item] Base Item state handles required.');
    }
    def.feedback.style.use(
      tw(
        'inline-flex min-h-4 min-w-0 items-center gap-2 rounded-xs font-normal text-[14px] leading-[20px] text-foreground outline-none cursor-pointer transition-[border,box-shadow]'
      )
    );
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.hovered).eq(true),
          w.state(state.disabled).eq(false),
          w.not(w.meta('colorScheme').eq('dark'))
        ),
      intent: (i) => i.feedback.style.use(tw('text-[#005580]')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.hovered).eq(true),
          w.state(state.disabled).eq(false),
          w.meta('colorScheme').eq('dark')
        ),
      intent: (i) => i.feedback.style.use(tw('text-ring')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-65 cursor-not-allowed')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'forced-colors-focus-outline shadow-[inset_0_1px_1px_rgb(0_0_0/7.5%),0_0_8px_rgb(82_168_236/60%)] ring-1 ring-ring'
          )
        ),
    });
    return inherited.render;
  },
});
