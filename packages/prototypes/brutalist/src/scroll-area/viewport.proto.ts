import { definePrototype, tw } from '@proto.ui/core';
import { asScrollSurface } from '@proto.ui/hooks';
import { asScrollAreaViewport } from '@proto.ui/prototypes-base/scroll-area';
import type { BrutalistScrollAreaViewportExposes, BrutalistScrollAreaViewportProps } from './types';

export const BrutalistScrollAreaViewport = definePrototype<
  BrutalistScrollAreaViewportProps,
  BrutalistScrollAreaViewportExposes
>({
  name: 'brutalist-scroll-area-viewport',
  setup(def) {
    // P-BRUTALIST-SCROLL-AREA-VIEWPORT-BASE-INHERITANCE
    const viewportState = asScrollAreaViewport().stateHandles;
    if (!viewportState) {
      throw new Error(
        '[brutalist-scroll-area-viewport] asScrollAreaViewport must project Viewport state handles.'
      );
    }
    const { focusVisible } = viewportState;
    asScrollSurface().configure({ projection: 'composed' });
    // Prefer concrete supported tokens over size-full, which is not in the current CSS closure.
    def.feedback.style.use(tw('block h-full w-full overflow-auto rounded-none outline-none'));

    // P-BRUTALIST-SCROLL-AREA-VIEWPORT-FOCUS-RING
    // Drawn inside the box. The shared Brutalist focus tokens draw outward, and
    // the Root clips them with overflow-hidden, so the ring never appears.
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-ring ring-inset ring-offset-0')),
    });

    return (renderer) => [renderer.r.slot()];
  },
});
