import { definePrototype, tw } from '@proto.ui/core';
import { asTabsList } from '@proto.ui/prototypes-base/tabs';
import type { BrutalistTabsListExposes, BrutalistTabsListProps } from './types';

const tabsList = definePrototype<BrutalistTabsListProps, BrutalistTabsListExposes>({
  // P-BRUTALIST-TABS-LIST-ENTRY
  name: 'brutalist-tabs-list',
  setup(def) {
    // P-BRUTALIST-TABS-LIST-BASE-INHERITANCE
    asTabsList();
    // P-BRUTALIST-TABS-LIST-VISUAL-GRAMMAR — square strip panel: rounded-none, border-2
    // border-black, hard shadow, bg-secondary-background fill, text-foreground, h-11, p-1.
    def.feedback.style.use(
      tw(
        'inline-flex h-11 items-center rounded-none border-2 border-black bg-secondary-background p-1 text-foreground shadow-[3px_3px_0_0_#000]'
      )
    );
  },
});

export default tabsList;
