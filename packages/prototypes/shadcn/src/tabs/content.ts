import { definePrototype, tw } from '@proto.ui/core';
import { asTabsContent } from '@proto.ui/prototypes-base';
import type { ShadcnTabsContentExposes, ShadcnTabsContentProps } from './types';

const tabsContent = definePrototype<ShadcnTabsContentProps, ShadcnTabsContentExposes>({
  name: 'shadcn-tabs-content',
  setup(def) {
    asTabsContent();
    def.feedback.style.use(
      tw(
        'block w-full min-h-28 rounded-xl border border-border/60 bg-background p-4 text-sm leading-6 shadow-xs outline-none'
      )
    );
  },
});

export default tabsContent;
