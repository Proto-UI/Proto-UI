import { defineAsHook, definePrototype, tw, type DefHandle } from '@proto.ui/core';
import { asAccessible, asFocusEntry } from '@proto.ui/hooks';
import { createTabsPartId, TABS_CONTEXT, TABS_FAMILY, type TabsContextValue } from './shared';
import type { TabsContentAsHookContract, TabsContentExposes, TabsContentProps } from './types';

function syncCurrentFromContext(
  nextValue: string,
  ownValue: string,
  current: { set(value: boolean, reason?: string): void },
  hidden: { set(value: boolean, reason?: string): void },
  focusEntry: { setDisabled(disabled: boolean): void }
): void {
  const nextCurrent = ownValue === nextValue;
  current.set(nextCurrent, 'reason: tabs context sync => current');
  hidden.set(!nextCurrent, 'reason: tabs context sync => hidden');
  focusEntry.setDisabled(!nextCurrent);
}

function setupTabsContent(def: DefHandle<TabsContentProps, TabsContentExposes>): void {
  const accessible = asAccessible();
  // P-BASE-TABS-CONTENT-ROLE-PANEL, P-BASE-TABS-CONTENT-PROTOCOL-DEPENDENCY
  // P-BASE-TABS-CONTENT-CLAIM-ROLE, P-BASE-TABS-CONTENT-SAME-DOMAIN
  def.anatomy.claim(TABS_FAMILY, { role: 'content' });
  // P-BASE-TABS-CONTENT-CURRENT-DERIVED
  const current = def.state.bool('current', false);
  const hidden = def.state.bool('hidden', true);
  const contentId = def.state.string('contentId', '');
  const triggerId = def.state.string('triggerId', '');
  // P-BASE-TABS-CONTENT-FOCUS-ENTRY
  const focusEntry = asFocusEntry<TabsContentProps>();
  focusEntry.configure({
    strategy: 'descendant-first',
    fallback: 'self',
    disabled: true,
  });

  // P-BASE-TABS-CONTENT-PROP-VALUE, P-BASE-TABS-CONTENT-PRESENCE-POLICY
  def.props.define({
    value: { type: 'string', empty: 'fallback' },
    keepMounted: { type: 'boolean', empty: 'fallback' },
  });
  def.props.setDefaults({
    value: '',
    keepMounted: false,
  });

  let ownValue = '';
  let rootId = '';
  let keepMounted = false;
  // P-BASE-TABS-CONTENT-CURRENT-EXPOSE
  def.expose.state('current', current);
  def.expose.state('hidden', hidden);

  // P-BASE-TABS-CONTENT-A11Y-ROLE, P-BASE-TABS-CONTENT-A11Y-LABELLEDBY-TARGET
  // P-BASE-TABS-CONTENT-A11Y-HIDDEN, P-BASE-TABS-CONTENT-HIDDEN-WHEN-INACTIVE
  accessible.id(contentId);
  accessible.role('tabpanel');
  accessible.state('hidden', hidden);
  accessible.relation('labelledBy', { target: triggerId });

  const syncIds = () => {
    // P-BASE-TABS-A11Y-RELATIONSHIP-TARGET
    contentId.set(createTabsPartId(rootId, 'content', ownValue), 'reason: tabs content id sync');
    triggerId.set(
      createTabsPartId(rootId, 'trigger', ownValue),
      'reason: tabs content relation sync'
    );
  };

  const syncContext = (
    next: TabsContextValue,
    lifecycle: { setPresent(present: boolean): void }
  ) => {
    // P-BASE-TABS-CONTENT-CONTEXT-CONSUME, P-BASE-TABS-CONTENT-CURRENT-DERIVED
    rootId = next.rootId;
    syncIds();
    syncCurrentFromContext(next.value, ownValue, current, hidden, focusEntry);
    const nextCurrent = next.value === ownValue;
    // P-BASE-TABS-CONTENT-DEFAULT-L1-DETACH, P-BASE-TABS-CONTENT-PRESENCE-POLICY
    lifecycle.setPresent(keepMounted || nextCurrent);
  };

  def.context.subscribe(TABS_CONTEXT, (run, next) => {
    syncContext(next, run.lifecycle);
  });

  const syncProps = (next: Readonly<TabsContentProps>) => {
    ownValue = next.value ?? '';
    keepMounted = next.keepMounted ?? false;
  };

  def.lifecycle.onCreated((run) => {
    syncProps(run.props.get());
    syncContext(run.context.read(TABS_CONTEXT), run.lifecycle);
  });

  def.lifecycle.onMounted((run) => {
    syncContext(run.context.read(TABS_CONTEXT), run.lifecycle);
  });

  def.props.watch(['value', 'keepMounted'], (run, next) => {
    syncProps(next);
    syncContext(run.context.read(TABS_CONTEXT), run.lifecycle);
  });

  // TODO(P-BASE-TABS-CONTENT-HIDDEN-WHEN-INACTIVE): Web currently also receives
  // a host hidden attribute from a11y state projection; this style fallback
  // keeps current feedback-style demos stable until hidden is modeled as a
  // dedicated host capability outside a11y.
  def.rule({
    when: (w) => w.state(hidden).eq(true),
    intent: (i) => i.feedback.style.use(tw('hidden')),
  });
}

/*
 * P-BASE-TABS-CONTENT-TABINDEX-DEFERRED is deprecated and intentionally has no implementation.
 */

// P-BASE-TABS-CONTENT-AUTHORING-ENTRIES
export const asTabsContent = defineAsHook<
  TabsContentProps,
  TabsContentExposes,
  TabsContentAsHookContract
>({
  name: 'as-tabs-content',
  setup: setupTabsContent,
});

const tabsContent = definePrototype({
  name: 'base-tabs-content',
  setup: setupTabsContent,
});

export default tabsContent;
