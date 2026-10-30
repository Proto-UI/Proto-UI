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
    const inherited = asSeparatorRoot();
    const state = inherited.stateHandles;
    if (!state) throw new Error('[bootstrap-2-3-2-separator-root] Base state handles required.');
    def.feedback.style.use(tw('shrink-0 border-0'));
    def.rule({
      when: (w) => w.state(state.orientation).eq('horizontal'),
      intent: (i) =>
        i.feedback.style.use(
          tw('w-full h-0 my-[20px] border-t border-b border-[#eee_#eee_#fff_#eee]')
        ),
    });
    def.rule({
      when: (w) => w.state(state.orientation).eq('vertical'),
      // Vertical is a Proto extension of the two-tone historical horizontal rule.
      intent: (i) =>
        i.feedback.style.use(
          tw('h-full w-0 mx-[20px] border-l border-r border-[#eee_#fff_#eee_#eee]')
        ),
    });
    return inherited.render;
  },
});
