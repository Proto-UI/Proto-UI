import { definePrototype, tw } from '@proto.ui/core';
import {
  asTransition,
  type TransitionExposes,
  type TransitionProps,
} from '@proto.ui/prototypes-base/transition';

/**
 * Brutalist standalone Transition projection over the exact Base phase
 * machine. The flat/fade boundary binds the borrowed phase to endpoint opacity
 * only: no zoom, slide, translate, shadow or invented motion vocabulary is
 * admitted, and no timer, host animation engine, semantic or anchor owner is
 * added. Base keeps phase sequencing, presence, controls, interrupts, fallback
 * completion and the reduced-motion duration collapse.
 */
export const transition = definePrototype<TransitionProps, TransitionExposes>({
  name: 'brutalist-transition',
  modules: asTransition.modules,
  setup(def) {
    const behavior = asTransition();
    // P-BRUTALIST-TRANSITION-FLAT-FADE-BOUNDARY: endpoint visibility only.
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
    // The caller's authored content is preserved transparently; this part owns
    // no slot of its own and no native anchor ownership is intercepted.
    return (render) => render.slot();
  },
});

export default transition;
