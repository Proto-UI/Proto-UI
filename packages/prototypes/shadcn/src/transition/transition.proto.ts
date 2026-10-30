import { definePrototype } from '@proto.ui/core';
import {
  asTransition,
  type TransitionExposes,
  type TransitionProps,
} from '@proto.ui/prototypes-base/transition';

/** Proto extension: standalone perceptual presence, with no invented Shadcn motion. */
export const transition = definePrototype<TransitionProps, TransitionExposes>({
  name: 'shadcn-transition',
  modules: asTransition.modules,
  setup() {
    asTransition();
    // As in Base's direct entry, Transition is transparent, not a visual element.
    return (render) => render.slot();
  },
});

export default transition;
