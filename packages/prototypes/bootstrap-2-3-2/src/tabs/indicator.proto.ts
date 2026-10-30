import { definePrototype } from '@proto.ui/core';
import {
  asTabsIndicator,
  type TabsIndicatorProps,
  type TabsIndicatorExposes,
} from '@proto.ui/prototypes-base/tabs';
/*
 * Semantic-only projection: Bootstrap 2.3.2 nav-tabs has no indicator part —
 * the active tab is marked by the Trigger's own border treatment. This part
 * keeps the real Base protocol (value/activeValue/orientation derived through
 * asTabsIndicator) but contributes no paint: Base defers layout measurement
 * and positioning to downstream styling, so no geometry is invented here.
 */
export default definePrototype<TabsIndicatorProps, TabsIndicatorExposes>({
  name: 'bootstrap-2-3-2-tabs-indicator',
  setup() {
    asTabsIndicator();
  },
});
