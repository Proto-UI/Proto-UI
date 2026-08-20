import { definePrototype, tw } from '@proto.ui/core';
import { asTabsRoot } from '@proto.ui/prototypes-base/tabs';
import type { BrutalistTabsRootExposes, BrutalistTabsRootProps } from './types';

const tabsRoot = definePrototype<BrutalistTabsRootProps, BrutalistTabsRootExposes>({
  // P-BRUTALIST-TABS-ENTRY
  name: 'brutalist-tabs-root',
  setup(def) {
    // P-BRUTALIST-TABS-BASE-INHERITANCE
    asTabsRoot();
    // P-BRUTALIST-TABS-VISUAL-GRAMMAR — vertical stack carrying inherited text-foreground.
    def.feedback.style.use(tw('flex flex-col gap-3 text-foreground'));
  },
});

export default tabsRoot;
