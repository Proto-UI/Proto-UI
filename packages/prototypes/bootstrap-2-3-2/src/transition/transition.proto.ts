import { definePrototype } from '@proto.ui/core';
import {
  asTransition,
  type TransitionProps,
  type TransitionExposes,
} from '@proto.ui/prototypes-base/transition';

// Standalone presence protocol, not a .fade or .collapse widget. Those pinned
// Bootstrap recipes have different trajectories/durations; selecting either
// here would invent an animation for the caller's otherwise transparent slot.
export const transition = definePrototype<TransitionProps, TransitionExposes>({
  name: 'bootstrap-2-3-2-transition',
  modules: asTransition.modules,
  setup() {
    asTransition();
    return (render) => render.slot();
  },
});

export default transition;
