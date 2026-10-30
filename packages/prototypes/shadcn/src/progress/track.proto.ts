import { definePrototype } from '@proto.ui/core';
import { type ProgressPartExposes, asProgressTrack } from '@proto.ui/prototypes-base/progress';
import { setupProgressTrackPaint } from './visual';
import type { ShadcnProgressPartProps } from './types';
export default definePrototype<ShadcnProgressPartProps, ProgressPartExposes>({
  name: 'shadcn-progress-track',
  modules: asProgressTrack.modules,
  setup(def) {
    const inherited = asProgressTrack();
    setupProgressTrackPaint(def);
    return inherited.render;
  },
});
