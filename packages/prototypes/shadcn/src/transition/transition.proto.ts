import { definePrototype, tw } from '@proto.ui/core';
import {
  asTransition,
  type TransitionExposes,
  type TransitionProps,
} from '@proto.ui/prototypes-base/transition';

/**
 * Shadcn standalone Transition projection over the exact Base phase machine.
 * Binds the borrowed phase to bounded endpoint opacity only so callers retain
 * transparent slot ownership without invented motion choreography.
 */
export const transition = definePrototype<TransitionProps, TransitionExposes>({
  name: 'shadcn-transition',
  modules: asTransition.modules,
  setup(def) {
    const behavior = asTransition();
    // P-SHADCN-TRANSITION-VISUAL: bounded endpoint visibility only.
    def.rule({
      when: (w) =>
        w.any(
          w.state(behavior.transitionState).eq('entering'),
          w.state(behavior.transitionState).eq('entered')
        ),
      intent: (i) => i.feedback.style.use(tw('opacity-100')),
    });
    def.rule({
      when: (w) =>
        w.any(
          w.state(behavior.transitionState).eq('closed'),
          w.state(behavior.transitionState).eq('preparing'),
          w.state(behavior.transitionState).eq('leaving')
        ),
      intent: (i) => i.feedback.style.use(tw('opacity-0')),
    });
    // As in Base's direct entry, Transition is transparent, not a visual element.
    return (render) => render.slot();
  },
});

export default transition;
