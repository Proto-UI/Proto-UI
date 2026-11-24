import { definePrototype, tw } from '@proto.ui/core';
import {
  asCheckboxRoot,
  type CheckboxRootProps,
  type CheckboxRootExposes,
} from '@proto.ui/prototypes-base/checkbox';

// Independently expressed Bootstrap 2.3.2 design-language projection.
// Base retains all semantics; source attribution: ../../THIRD_PARTY_NOTICES.md.
// Custom parts and glyph; not the upstream browser-native checkbox skin.
export default definePrototype<CheckboxRootProps, CheckboxRootExposes>({
  name: 'bootstrap-2-3-2-checkbox-root',
  setup(def) {
    const inherited = asCheckboxRoot();
    const state = inherited.stateHandles;
    if (!state) throw new Error('[bootstrap-2-3-2-checkbox-root] Base state handles required.');
    def.feedback.style.use(
      tw(
        'inline-flex w-[14px] h-[14px] shrink-0 items-center justify-center rounded-[2px] border border-foreground bg-[#f5f5f5_linear-gradient(#fff,#e6e6e6)_0_0_repeat-x] text-[#333] select-none cursor-pointer shadow-[inset_0_1px_1px_rgb(0_0_0/7.5%)]'
      )
    );
    // The period form control uses the same neutral face in all states. The
    // independent Indicator conveys checked/mixed; hover/press follow the
    // Bootstrap 2.3.2 beveled gradient response and focus adds the blue glow.
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.hovered).eq(true),
          w.state(state.pressed).eq(false),
          w.state(state.disabled).eq(false)
        ),
      intent: (i) =>
        i.feedback.style.use(tw('bg-[#e6e6e6_linear-gradient(#fff,#e6e6e6)_0_-15px_repeat-x]')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.pressed).eq(true),
          w.state(state.disabled).eq(false),
          w.state(state.readOnly).eq(false)
        ),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'bg-[#e6e6e6_none_0_0_repeat-x] shadow-[inset_0_2px_4px_rgb(0_0_0/15%),0_1px_2px_rgb(0_0_0/5%)]'
          )
        ),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'outline-none border-[rgb(82_168_236/80%)] shadow-[inset_0_1px_1px_rgb(0_0_0/7.5%),0_0_8px_rgb(82_168_236/60%)] ring-2 ring-ring forced-colors-focus-outline'
          )
        ),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw('bg-[#e6e6e6_none_0_0_repeat-x] opacity-65 cursor-not-allowed shadow-none')
        ),
    });
    return inherited.render;
  },
});
