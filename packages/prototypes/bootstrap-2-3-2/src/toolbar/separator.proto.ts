import { definePrototype, tw } from '@proto.ui/core';
import {
  asToolbarSeparator,
  type ToolbarSeparatorProps,
  type ToolbarSeparatorExposes,
} from '@proto.ui/prototypes-base/toolbar';

export default definePrototype<ToolbarSeparatorProps, ToolbarSeparatorExposes>({
  name: 'bootstrap-2-3-2-toolbar-separator',
  modules: asToolbarSeparator.modules,
  setup(def) {
    const behavior = asToolbarSeparator();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[bootstrap-2-3-2-toolbar] Separator state unavailable.');

    def.feedback.style.use(tw('shrink-0 self-stretch bg-border'));
    def.rule({
      when: (w) => w.state(state.orientation).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('w-[1px] h-auto mx-[5px] my-[2px]')),
    });
    def.rule({
      when: (w) => w.state(state.orientation).eq('horizontal'),
      intent: (i) => i.feedback.style.use(tw('h-[1px] w-full my-[5px] mx-0')),
    });
    return behavior.render;
  },
});
