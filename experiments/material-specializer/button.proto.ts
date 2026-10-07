import { definePrototype, tw } from '@proto.ui/core';
import { asButton, type ButtonExposes, type ButtonProps } from '@proto.ui/prototypes-base/button';
import { declareMaterial } from './module';

// This experimental Prototype is deliberately not in the public family catalog.
// The private specializer must admit/consume its declaration explicitly.
export default definePrototype<ButtonProps, ButtonExposes>({
  name: 'experimental-owned-material-button',
  modules: [
    declareMaterial({
      version: 1,
      material: { kind: 'refractive', variant: 'regular' },
      sampling: { kind: 'owned-scene', slot: 'scene' },
      shape: { kind: 'rounded-rect', geometry: 'style' },
      fallback: { fill: [0.94, 0.94, 0.96, 1], foreground: 'style' },
      interaction: { kind: 'button-press' },
    }),
  ],
  setup(def) {
    const state = asButton().stateHandles;
    if (!state) throw new Error('Base Button state handles are required');
    // Geometry and foreground remain style-owned; material owns only fill.
    def.feedback.style.use(
      tw(
        'inline-flex items-center justify-center px-5 py-2 text-sm font-medium select-none cursor-pointer rounded-full text-foreground selection:bg-primary selection:text-primary-foreground'
      )
    );
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-ring ring-offset-2')),
    });
  },
});
