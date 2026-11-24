import { definePrototype, tw } from '@proto.ui/core';
import {
  asToolbarSeparator,
  type ToolbarSeparatorProps,
  type ToolbarSeparatorExposes,
} from '@proto.ui/prototypes-base/toolbar';

export default definePrototype<ToolbarSeparatorProps, ToolbarSeparatorExposes>({
  name: 'brutalist-toolbar-separator',
  modules: asToolbarSeparator.modules,
  setup(def) {
    const behavior = asToolbarSeparator();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[brutalist-toolbar] Separator state unavailable.');

    def.feedback.style.use(tw('shrink-0 bg-foreground'));
    def.rule({
      when: (w) => w.state(state.orientation).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('w-[2px] self-stretch mx-1 my-0.5')),
    });
    def.rule({
      when: (w) => w.state(state.orientation).eq('horizontal'),
      intent: (i) => i.feedback.style.use(tw('h-[2px] w-full my-1 mx-0')),
    });
    return behavior.render;
  },
});
