import { definePrototype } from '@proto.ui/core';
import {
  asTabsIndicator,
  type TabsIndicatorProps,
  type TabsIndicatorExposes,
} from '@proto.ui/prototypes-base/tabs';
/*
 * Semantic-only projection: the segmented recipe marks selection on the
 * Trigger itself; a decorative child gets no material owner. Keeps the real
 * Base protocol (value/activeValue/orientation via asTabsIndicator) with no
 * paint — Base defers layout measurement/positioning to downstream styling.
 */
export default definePrototype<TabsIndicatorProps, TabsIndicatorExposes>({
  name: 'liquid-glass-tabs-indicator',
  setup() {
    asTabsIndicator();
  },
});
