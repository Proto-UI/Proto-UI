import { definePrototype } from '@proto.ui/core';
import { type ProgressPartExposes, asProgressLabel } from '@proto.ui/prototypes-base/progress';
import { setupProgressLabelPaint } from './visual';
import type { ShadcnProgressPartProps } from './types';
export default definePrototype<ShadcnProgressPartProps, ProgressPartExposes>({
  name: 'shadcn-progress-label',
  modules: asProgressLabel.modules,
  setup(def) {
    const inherited = asProgressLabel();
    setupProgressLabelPaint(def);
    return inherited.render;
  },
});
