import { definePrototype, tw } from '@proto.ui/core';
import { asScrollAreaViewport } from '@proto.ui/prototypes-base/scroll-area';
import type { ShadcnScrollAreaViewportExposes, ShadcnScrollAreaViewportProps } from './types';
const scrollAreaViewport = definePrototype<
  ShadcnScrollAreaViewportProps,
  ShadcnScrollAreaViewportExposes
>({
  name: 'shadcn-scroll-area-viewport',
  setup(def) {
    asScrollAreaViewport();
    def.feedback.style.use(tw('h-full w-full rounded-[inherit]'));
  },
});
export default scrollAreaViewport;
