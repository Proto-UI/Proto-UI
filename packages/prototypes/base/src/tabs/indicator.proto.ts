import { asAccessible } from '@proto.ui/hooks';
import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { TABS_CONTEXT, TABS_FAMILY, type TabsContextValue } from './shared';
import type {
  TabsIndicatorAsHookContract,
  TabsIndicatorExposes,
  TabsIndicatorProps,
} from './types';

function setupTabsIndicator(def: DefHandle<TabsIndicatorProps, TabsIndicatorExposes>): void {
  // P-BASE-TABS-INDICATOR-PROTOCOL-DEPENDENCY
  // P-BASE-TABS-INDICATOR-ROLE-INDICATOR, P-BASE-TABS-INDICATOR-CLAIM-ROLE
  // P-BASE-TABS-INDICATOR-SAME-DOMAIN
  def.anatomy.claim(TABS_FAMILY, { role: 'indicator' });

  // P-BASE-TABS-INDICATOR-DERIVED-VALUE, P-BASE-TABS-INDICATOR-DERIVED-ACTIVE-VALUE
  // P-BASE-TABS-INDICATOR-DERIVED-ORIENTATION
  const value = def.state.string('value', '');
  const activeValue = def.state.string('activeValue', '');
  const orientation = def.state.string('orientation', 'horizontal', {
    options: ['horizontal', 'vertical'],
  });

  def.expose.state('value', value);
  def.expose.state('activeValue', activeValue);
  def.expose.state('orientation', orientation);

  const syncContext = (next: TabsContextValue) => {
    value.set(next.value ?? '', 'reason: tabs indicator context value sync');
    activeValue.set(next.activeValue ?? '', 'reason: tabs indicator context active value sync');
    orientation.set(
      next.orientation ?? 'horizontal',
      'reason: tabs indicator context orientation sync'
    );
  };

  // P-BASE-TABS-INDICATOR-CONTEXT-CONSUME
  def.context.subscribe(TABS_CONTEXT, (_run, next) => {
    syncContext(next);
  });

  def.lifecycle.onMounted((run) => {
    syncContext(run.context.read(TABS_CONTEXT));
  });
}

/*
 * P-BASE-TABS-INDICATOR criteria outside Tabs-indicator-internal prototype syntax:
 * - P-BASE-TABS-INDICATOR-NO-SELECTION-OWNER: absence of value props and valueChange is the implementation.
 * - P-BASE-TABS-INDICATOR-NO-EVENT-TARGET: absence of def.event usage is the implementation.
 * - P-BASE-TABS-INDICATOR-NO-FOCUS-TARGET: absence of asFocusable/focusSelf is the implementation.
 * - P-BASE-TABS-INDICATOR-PRESENTATIONAL-A11Y: absence of asAccessible() control syntax is the implementation.
 * - P-BASE-TABS-INDICATOR-NO-LAYOUT-MEASUREMENT: layout measurement is deferred to downstream styled prototypes.
 * - P-BASE-TABS-INDICATOR-NO-AUTO-POSITIONING: no position or transform props are accepted.
 * - P-BASE-TABS-INDICATOR-NO-VISUAL-VARIANT-CORE: visual parameters are owned by downstream styled prototypes.
 */

// P-BASE-TABS-INDICATOR-AUTHORING-ENTRIES
export const asTabsIndicator = defineAsHook<
  TabsIndicatorProps,
  TabsIndicatorExposes,
  TabsIndicatorAsHookContract
>({
  name: 'as-tabs-indicator',
  setup: setupTabsIndicator,
});

const tabsIndicator = definePrototype({
  name: 'base-tabs-indicator',
  setup: setupTabsIndicator,
});

export default tabsIndicator;
