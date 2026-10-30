import { definePrototype } from '@proto.ui/core';
import { type ProgressPartExposes, asProgressValue } from '@proto.ui/prototypes-base/progress';
import { setupProgressValuePaint } from './visual';
import type { ShadcnProgressPartProps } from './types';
export default definePrototype<ShadcnProgressPartProps, ProgressPartExposes>({
  name: 'shadcn-progress-value',
  modules: asProgressValue.modules,
  setup(def) {
    const inherited = asProgressValue();
    setupProgressValuePaint(def);
    return inherited.render;
  },
});
