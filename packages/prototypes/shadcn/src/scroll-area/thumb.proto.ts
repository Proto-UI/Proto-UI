import { definePrototype, tw } from '@proto.ui/core';
import { asScrollAreaThumb } from '@proto.ui/prototypes-base/scroll-area';
import type { ShadcnScrollAreaThumbExposes, ShadcnScrollAreaThumbProps } from './types';

const scrollAreaThumb = definePrototype<ShadcnScrollAreaThumbProps, ShadcnScrollAreaThumbExposes>({
  name: 'shadcn-scroll-area-thumb',
  setup(def) {
    asScrollAreaThumb();
    def.feedback.style.use(tw('relative flex-1 rounded-full bg-border'));
  },
});

export default scrollAreaThumb;
