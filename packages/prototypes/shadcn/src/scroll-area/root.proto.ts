import { definePrototype, tw } from '@proto.ui/core';
import { asScrollAreaRoot } from '@proto.ui/prototypes-base/scroll-area';
import type { ShadcnScrollAreaRootExposes, ShadcnScrollAreaRootProps } from './types';
const scrollAreaRoot = definePrototype<ShadcnScrollAreaRootProps, ShadcnScrollAreaRootExposes>({
  name: 'shadcn-scroll-area-root',
  setup(def) {
    asScrollAreaRoot();
    def.feedback.style.use(tw('relative overflow-hidden'));
  },
});
export default scrollAreaRoot;
