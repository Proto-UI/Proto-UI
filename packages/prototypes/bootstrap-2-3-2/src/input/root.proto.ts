import { definePrototype, tw } from '@proto.ui/core';
import {
  asInputRoot,
  type InputRootProps,
  type InputRootExposes,
} from '@proto.ui/prototypes-base/input';

// Independently expressed Bootstrap 2.3.2 design-language projection.
// Base retains all semantics; source attribution: ../../THIRD_PARTY_NOTICES.md.
export default definePrototype<InputRootProps, InputRootExposes>({
  name: 'bootstrap-2-3-2-input-root',
  modules: asInputRoot.modules,
  setup(def) {
    const state = asInputRoot().stateHandles;
    if (!state) throw new Error('[bootstrap-2-3-2-input-root] Base state handles required.');
    def.feedback.style.use(
      tw(
        'block w-full border border-border bg-background text-foreground rounded-[4px] px-1.5 py-1 text-sm font-normal leading-5 shadow-[inset_0_1px_1px_rgb(0_0_0/7.5%)]'
      )
    );
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw('outline-none ring-2 ring-ring ring-offset-2 ring-offset-background')
        ),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-65 cursor-not-allowed bg-muted')),
    });
    return () => null;
  },
});
