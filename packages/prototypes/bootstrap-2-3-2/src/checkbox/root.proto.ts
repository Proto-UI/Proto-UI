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
    // independent Indicator conveys checked/mixed; only focus gets blue ink.
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'outline-none border-[rgb(82_168_236/80%)] ring-2 ring-ring forced-colors-focus-outline'
          )
        ),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-65 cursor-not-allowed')),
    });
    return inherited.render;
  },
});
