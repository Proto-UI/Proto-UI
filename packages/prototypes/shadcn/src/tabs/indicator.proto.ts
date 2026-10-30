import { definePrototype, tw } from '@proto.ui/core';
import { asTabsIndicator } from '@proto.ui/prototypes-base/tabs';
import { setupTabsVisual } from './visual';
import type { ShadcnTabsIndicatorExposes, ShadcnTabsIndicatorProps } from './types';
const tabsIndicator = definePrototype<ShadcnTabsIndicatorProps, ShadcnTabsIndicatorExposes>({
  name: 'shadcn-tabs-indicator',
  setup(def) {
    // asTabsIndicator once: value/activeValue/orientation derive from the
    // Base context; no selection, event, focus or accessibility target.
    asTabsIndicator();
    setupTabsVisual(def);
    /*
     * Neutral paint only: the upstream `after:bg-foreground` color. Base
     * defers layout measurement and positioning to downstream styling, so no
     * geometry is promised here (P-BASE-TABS-INDICATOR-NO-LAYOUT-MEASUREMENT,
     * -NO-AUTO-POSITIONING); consumers place/size the element themselves.
     */
    def.feedback.style.use(tw('bg-foreground'));
  },
});
export default tabsIndicator;
