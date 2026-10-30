import { definePrototype, tw } from '@proto.ui/core';
import { asScrollAreaRoot } from '@proto.ui/prototypes-base/scroll-area';
import { setupShadcnStyleScope } from '../style-scope';
import type { ShadcnScrollAreaRootExposes, ShadcnScrollAreaRootProps } from './types';

const scrollAreaRoot = definePrototype<ShadcnScrollAreaRootProps, ShadcnScrollAreaRootExposes>({
  name: 'shadcn-scroll-area-root',
  modules: asScrollAreaRoot.modules,
  setup(def) {
    const inherited = asScrollAreaRoot();
    setupShadcnStyleScope(def);
    def.feedback.style.use(tw('relative overflow-hidden'));
    return inherited.render;
  },
});

export default scrollAreaRoot;
