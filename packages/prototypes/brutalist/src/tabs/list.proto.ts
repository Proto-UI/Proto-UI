import { definePrototype, tw } from '@proto.ui/core';
import { asTabsList } from '@proto.ui/prototypes-base/tabs';
import type { BrutalistTabsListExposes, BrutalistTabsListProps } from './types';

const tabsList = definePrototype<BrutalistTabsListProps, BrutalistTabsListExposes>({
  // P-BRUTALIST-TABS-LIST-ENTRY
  name: 'brutalist-tabs-list',
  setup(def) {
    // P-BRUTALIST-TABS-LIST-BASE-INHERITANCE
    asTabsList();
    // P-BRUTALIST-TABS-LIST-VISUAL-GRAMMAR — rounded flat strip panel: rounded-base, border-2
    // border-black, hard shadow, bg-background fill, text-foreground, h-12, p-1.
    def.feedback.style.use(
      tw(
        'inline-flex h-12 items-center rounded-base border-2 border-black bg-background p-1 text-foreground'
      )
    );
  },
});

export default tabsList;
