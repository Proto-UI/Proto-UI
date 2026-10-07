import { definePrototype, tw } from '@proto.ui/core';
import {
  asSeparatorRoot,
  type SeparatorRootProps,
  type SeparatorRootExposes,
} from '@proto.ui/prototypes-base/separator';

// Independently expressed Bootstrap 2.3.2 design-language projection.
// Base retains all semantics; source attribution: ../../THIRD_PARTY_NOTICES.md.
export default definePrototype<SeparatorRootProps, SeparatorRootExposes>({
  name: 'bootstrap-2-3-2-separator-root',
  setup(def) {
    const state = asSeparatorRoot().stateHandles;
    if (!state) throw new Error('[bootstrap-2-3-2-separator-root] Base state handles required.');
    def.feedback.style.use(tw('shrink-0 bg-border'));
    def.rule({
      when: (w) => w.state(state.orientation).eq('horizontal'),
      intent: (i) => i.feedback.style.use(tw('h-px w-full')),
    });
    def.rule({
      when: (w) => w.state(state.orientation).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('h-full w-px')),
    });
    return () => null;
  },
});
