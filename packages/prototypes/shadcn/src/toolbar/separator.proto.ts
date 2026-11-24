import { definePrototype, tw } from '@proto.ui/core';
import { asToolbarSeparator } from '@proto.ui/prototypes-base/toolbar';
import { setupShadcnStyleSelection } from '../style-scope';
import type { ShadcnToolbarSeparatorProps, ShadcnToolbarSeparatorExposes } from './types';

export default definePrototype<ShadcnToolbarSeparatorProps, ShadcnToolbarSeparatorExposes>({
  name: 'shadcn-toolbar-separator',
  modules: asToolbarSeparator.modules,
  setup(def) {
    const behavior = asToolbarSeparator();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[shadcn-toolbar] Separator state unavailable.');

    const style = setupShadcnStyleSelection(def, 'rhea');

    def.feedback.style.use(tw('shrink-0 self-stretch bg-border'));
    def.rule({
      when: (w) =>
        w.all(w.state(state.orientation).eq('vertical'), w.not(w.state(style).eq('mira'))),
      intent: (i) => i.feedback.style.use(tw('w-px h-auto mx-1 my-1')),
    });
    def.rule({
      when: (w) => w.all(w.state(state.orientation).eq('vertical'), w.state(style).eq('mira')),
      intent: (i) => i.feedback.style.use(tw('w-px h-auto mx-0.5 my-1')),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(state.orientation).eq('horizontal'), w.not(w.state(style).eq('mira'))),
      intent: (i) => i.feedback.style.use(tw('h-px w-auto my-1 mx-1')),
    });
    def.rule({
      when: (w) => w.all(w.state(state.orientation).eq('horizontal'), w.state(style).eq('mira')),
      intent: (i) => i.feedback.style.use(tw('h-px w-auto my-0.5 mx-1')),
    });
    return behavior.render;
  },
});
