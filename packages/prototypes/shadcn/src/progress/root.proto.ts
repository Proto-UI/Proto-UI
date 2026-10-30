import { definePrototype, tw } from '@proto.ui/core';
import { type ProgressRootExposes, asProgressRoot } from '@proto.ui/prototypes-base/progress';
import { setupShadcnStyleScope } from '../style-scope';
import type { ShadcnProgressRootProps } from './types';
export default definePrototype<ShadcnProgressRootProps, ProgressRootExposes>({
  name: 'shadcn-progress-root',
  modules: asProgressRoot.modules,
  setup(def) {
    const inherited = asProgressRoot();
    setupShadcnStyleScope(def);
    def.feedback.style.use(tw('flex w-full min-w-0 flex-wrap gap-3 text-foreground'));
    return inherited.render;
  },
});
