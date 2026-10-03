import { definePrototype, tw } from '@proto.ui/core';
import { asButton, type ButtonExposes, type ButtonProps } from '@proto.ui/prototypes-base/button';
import { declareOwnedMaterial } from './module';

// This source-only Prototype is deliberately not in the public family catalog.
// The private specializer must admit/consume its declaration explicitly.
export default definePrototype<ButtonProps, ButtonExposes>({
  name: 'experimental-owned-material-button',
  modules: [
    declareOwnedMaterial({
      version: 1,
      preset: 'liquidgl-owned-surface-v1',
      source: { kind: 'owned-texture', slot: 'scene' },
      shape: { kind: 'rounded-rect', radius: 24 },
      fallback: [0.94, 0.94, 0.96, 1],
      bindings: { pressed: 'pressed', disabled: 'disabled' },
    }),
  ],
  setup(def) {
    const state = asButton().stateHandles;
    if (!state) throw new Error('Base Button state handles are required');
    // No fill, backdrop or radius utility competes with the material declaration.
    def.feedback.style.use(
      tw(
        'inline-flex items-center justify-center px-5 py-2 text-sm font-medium select-none cursor-pointer'
      )
    );
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-ring ring-offset-2')),
    });
  },
});
