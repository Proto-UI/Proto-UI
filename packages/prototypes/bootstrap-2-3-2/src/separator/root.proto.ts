import { definePrototype, tw } from '@proto.ui/core';
import {
  asSeparatorRoot,
  type SeparatorRootProps,
  type SeparatorRootExposes,
} from '@proto.ui/prototypes-base/separator';

// Independently expressed Bootstrap 2.3.2 design-language projection.
// Renders Bootstrap 2.3.2's two-edge etched rule (#eeeeee / #ffffff) without
// built-in margins; Base retains orientation and decorative accessibility semantics.
// Source attribution: ../../THIRD_PARTY_NOTICES.md.
export default definePrototype<SeparatorRootProps, SeparatorRootExposes>({
  name: 'bootstrap-2-3-2-separator-root',
  modules: asSeparatorRoot.modules,
  setup(def) {
    const inherited = asSeparatorRoot();
    const state = inherited.stateHandles;
    if (!state) throw new Error('[bootstrap-2-3-2-separator-root] Base state handles required.');
    def.feedback.style.use(tw('block shrink-0 border-0 bg-transparent'));
    def.rule({
      when: (w) => w.state(state.orientation).eq('horizontal'),
      intent: (i) =>
        i.feedback.style.use(tw('w-full h-0 border-t border-b border-[#eee_#eee_#fff_#eee]')),
    });
    def.rule({
      when: (w) => w.state(state.orientation).eq('vertical'),
      intent: (i) =>
        i.feedback.style.use(tw('w-0 self-stretch border-l border-r border-[#eee_#fff_#eee_#eee]')),
    });
    return inherited.render;
  },
});
