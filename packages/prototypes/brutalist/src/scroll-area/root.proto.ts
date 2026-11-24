import { definePrototype, tw } from '@proto.ui/core';
import { asScrollAreaRoot } from '@proto.ui/prototypes-base/scroll-area';
import type { BrutalistScrollAreaRootExposes, BrutalistScrollAreaRootProps } from './types';

export const BrutalistScrollAreaRoot = definePrototype<
  BrutalistScrollAreaRootProps,
  BrutalistScrollAreaRootExposes
>({
  name: 'brutalist-scroll-area-root',
  modules: asScrollAreaRoot.modules,
  setup(def) {
    const inherited = asScrollAreaRoot();
    def.feedback.style.use(
      tw(
        'relative block overflow-hidden rounded-base border-2 border-foreground bg-background text-foreground font-sans font-medium'
      )
    );
    return inherited.render;
  },
});
