import { definePrototype, tw } from '@proto.ui/core';
import { asToggle, type ToggleProps, type ToggleExposes } from '@proto.ui/prototypes-base/toggle';

// Design-language extension: Base Toggle owns active state; Bootstrap 2.3.2
// stateful .btn is only the visual reference, not a copied jQuery behavior.
// Source attribution: ../../THIRD_PARTY_NOTICES.md.
export default definePrototype<ToggleProps, ToggleExposes>({
  name: 'bootstrap-2-3-2-toggle',
  setup(def) {
    const state = asToggle().stateHandles;
    if (!state) throw new Error('[bootstrap-2-3-2-toggle] Base state handles required.');
    def.feedback.style.use(
      tw(
        'inline-flex items-center justify-center border border-border select-none cursor-pointer whitespace-nowrap rounded-[4px] px-3 py-1 text-sm font-normal leading-5 bg-[linear-gradient(#fff,#e6e6e6)] text-foreground shadow-[inset_0_1px_0_rgb(255_255_255/20%),0_1px_2px_rgb(0_0_0/5%)]'
      )
    );
    def.rule({
      when: (w) => w.state(state.hovered).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-[#e6e6e6]')),
    });
    def.rule({
      when: (w) => w.state(state.pressed).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw('bg-[#e6e6e6] shadow-[inset_0_2px_4px_rgb(0_0_0/15%),0_1px_2px_rgb(0_0_0/5%)]')
        ),
    });
    def.rule({
      when: (w) => w.state(state.active).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw('bg-[#e6e6e6] shadow-[inset_0_2px_4px_rgb(0_0_0/15%),0_1px_2px_rgb(0_0_0/5%)]')
        ),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw('outline-none ring-2 ring-ring ring-offset-2 ring-offset-background')
        ),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-65 cursor-not-allowed')),
    });
  },
});
