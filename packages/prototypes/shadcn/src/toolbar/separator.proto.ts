import { definePrototype, tw } from '@proto.ui/core';
import { asToolbarSeparator } from '@proto.ui/prototypes-base/toolbar';
import type { ShadcnToolbarSeparatorProps, ShadcnToolbarSeparatorExposes } from './types';

export default definePrototype<ShadcnToolbarSeparatorProps, ShadcnToolbarSeparatorExposes>({
  name: 'shadcn-toolbar-separator',
  modules: asToolbarSeparator.modules,
  setup(def) {
    const behavior = asToolbarSeparator();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[shadcn-toolbar] Separator state unavailable.');
    // Shared border vocabulary; an ordinary passive divider, never an action.
    def.feedback.style.use(tw('shrink-0 self-stretch bg-border'));
    def.rule({
      when: (w) => w.state(state.orientation).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('w-px h-auto mx-1 my-0')),
    });
    def.rule({
      when: (w) => w.state(state.orientation).eq('horizontal'),
      intent: (i) => i.feedback.style.use(tw('h-px w-auto my-1 mx-0')),
    });
    return behavior.render;
  },
});
