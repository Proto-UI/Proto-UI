import { definePrototype, tw } from '@proto.ui/core';
import {
  asSwitchRoot,
  type SwitchRootProps,
  type SwitchRootExposes,
} from '@proto.ui/prototypes-base/switch';

// Independently expressed Bootstrap 2.3.2 design-language projection.
// Base retains all semantics; source attribution: ../../THIRD_PARTY_NOTICES.md.
// Extension: core Bootstrap 2.3.2 does not supply a Switch component.
export default definePrototype<SwitchRootProps, SwitchRootExposes>({
  name: 'bootstrap-2-3-2-switch-root',
  setup(def) {
    const state = asSwitchRoot().stateHandles;
    if (!state) throw new Error('[bootstrap-2-3-2-switch-root] Base state handles required.');
    def.feedback.style.use(
      tw(
        'inline-flex h-6 w-11 shrink-0 items-center justify-start border border-border px-0.5 bg-muted select-none cursor-pointer rounded-[4px] shadow-[inset_0_1px_1px_rgb(0_0_0/7.5%)]'
      )
    );
    def.rule({
      when: (w) => w.state(state.checked).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-primary border-primary justify-end')),
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
