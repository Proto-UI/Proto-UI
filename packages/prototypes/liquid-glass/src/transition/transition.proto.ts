// Standalone phase-driven family recipe over the exact Base Transition
// protocol. The projection styles only the borrowed perceptual phase; it adds
// no timer, host animation engine, extra semantic owner or material candidate.
import { definePrototype, tw } from '@proto.ui/core';
import {
  asTransition,
  type TransitionProps,
  type TransitionExposes,
} from '@proto.ui/prototypes-base/transition';

export const transition = definePrototype<TransitionProps, TransitionExposes>({
  name: 'liquid-glass-transition',
  modules: asTransition.modules,
  setup(def) {
    // Base owns the phase machine, presence/ViewIntent sequencing, controls,
    // interrupts, fallback completion and reduced-motion duration collapse.
    const behavior = asTransition();
    // Endpoint visibility only: retain Base timing and interruption defaults.
    // Interpolation and actual host animation completion are separate host
    // capabilities, not inferred from a phase or an Apple design reference.
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
    // no slot of its own and no platform-specific animation is assumed.
    return (r) => r.slot();
  },
});

export default transition;
