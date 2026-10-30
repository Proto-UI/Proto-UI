import { definePrototype, tw } from '@proto.ui/core';
import { asScrollSurface } from '@proto.ui/hooks';
import { asScrollAreaViewport } from '@proto.ui/prototypes-base/scroll-area';
import { setupShadcnStyleSelection } from '../style-scope';
import type { ShadcnScrollAreaViewportExposes, ShadcnScrollAreaViewportProps } from './types';

const scrollAreaViewport = definePrototype<
  ShadcnScrollAreaViewportProps,
  ShadcnScrollAreaViewportExposes
>({
  name: 'shadcn-scroll-area-viewport',
  modules: asScrollAreaViewport.modules,
  setup(def) {
    const inherited = asScrollAreaViewport();
    const state = inherited.stateHandles;
    if (!state) {
      throw new Error(
        '[shadcn-scroll-area-viewport] asScrollAreaViewport must project Viewport state handles.'
      );
    }
    setupShadcnStyleSelection(def, 'new-york-v4');
    asScrollSurface().configure({ projection: 'composed' });
    def.feedback.style.use(
      tw('h-full w-full rounded-[inherit] transition-[color,box-shadow] outline-none')
    );
    def.rule({
      when: (when) => when.state(state.focusVisible).eq(true),
      intent: (intent) =>
        intent.feedback.style.use(tw('ring-3 ring-ring/50 ring-inset outline-1 outline-ring')),
    });
    return inherited.render;
  },
});

export default scrollAreaViewport;
