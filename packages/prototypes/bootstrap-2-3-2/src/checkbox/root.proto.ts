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
    const state = asCheckboxRoot().stateHandles;
    if (!state) throw new Error('[bootstrap-2-3-2-checkbox-root] Base state handles required.');
    def.feedback.style.use(
      tw(
        'inline-flex size-5 shrink-0 items-center justify-center rounded-[4px] border border-border bg-secondary text-secondary-foreground select-none cursor-pointer shadow-[inset_0_1px_1px_rgb(0_0_0/7.5%)]'
      )
    );
    def.rule({
      when: (w) => w.state(state.checked).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground border-primary')),
    });
    def.rule({
      when: (w) => w.state(state.indeterminate).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground border-primary')),
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
