import { definePrototype, tw } from '@proto.ui/core';
import { asScrollAreaViewport } from '@proto.ui/prototypes-base/scroll-area';
import { asScrollSurface } from '@proto.ui/hooks';
import type { ShadcnScrollAreaViewportExposes, ShadcnScrollAreaViewportProps } from './types';
const scrollAreaViewport = definePrototype<
  ShadcnScrollAreaViewportProps,
  ShadcnScrollAreaViewportExposes
>({
  name: 'shadcn-scroll-area-viewport',
  setup(def) {
    asScrollAreaViewport();
    asScrollSurface().configure({ projection: 'composed' });
    def.feedback.style.use(tw('h-full w-full rounded-md'));
  },
});
export default scrollAreaViewport;
