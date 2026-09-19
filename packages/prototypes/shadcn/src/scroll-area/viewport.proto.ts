import { definePrototype, tw } from '@proto.ui/core';
import { asScrollSurface } from '@proto.ui/hooks';
import { asScrollAreaViewport } from '@proto.ui/prototypes-base/scroll-area';
import type { ShadcnScrollAreaViewportExposes, ShadcnScrollAreaViewportProps } from './types';

const scrollAreaViewport = definePrototype<
  ShadcnScrollAreaViewportProps,
  ShadcnScrollAreaViewportExposes
>({
  name: 'shadcn-scroll-area-viewport',
  setup(def) {
    const state = asScrollAreaViewport().stateHandles;
    if (!state) {
      throw new Error(
        '[shadcn-scroll-area-viewport] asScrollAreaViewport must project Viewport state handles.'
      );
    }
    asScrollSurface().configure({ projection: 'composed' });
    def.feedback.style.use(
      tw('h-full w-full rounded-md transition-[color,box-shadow] outline-none')
    );
    def.rule({
      when: (when) => when.state(state.focusVisible).eq(true),
      intent: (intent) =>
        intent.feedback.style.use(tw('ring-3 ring-ring/50 ring-inset outline-1 outline-ring')),
    });
    return (renderer) => [renderer.r.slot()];
  },
});

export default scrollAreaViewport;
