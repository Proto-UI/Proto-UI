import { defineAsHook, definePrototype, type DefHandle } from '@proto.ui/core';
import { asAccessible, asFocusRoving } from '@proto.ui/hooks';
import { TABS_CONTEXT, TABS_FAMILY } from './shared';
import type { TabsListAsHookContract, TabsListExposes, TabsListProps } from './types';

function setupTabsList(def: DefHandle<TabsListProps, TabsListExposes>): void {
  const accessible = asAccessible();
  // P-BASE-TABS-LIST-ROLE-COLLECTION, P-BASE-TABS-LIST-PROTOCOL-DEPENDENCY
  // P-BASE-TABS-LIST-CLAIM-ROLE, P-BASE-TABS-LIST-SAME-DOMAIN
  def.anatomy.claim(TABS_FAMILY, { role: 'list' });
  // P-BASE-TABS-LIST-PROP-LOOP, P-BASE-TABS-LIST-PROP-A11Y-LABEL
  def.props.define({
    orientation: { type: 'enum', empty: 'fallback', options: ['horizontal', 'vertical'] },
    loop: { type: 'boolean', empty: 'fallback' },
    a11yLabel: { type: 'string', empty: 'fallback' },
  });
  def.props.setDefaults({
    orientation: 'horizontal',
    loop: false,
    a11yLabel: '',
  });

  const orientation = def.state.string('orientation', 'horizontal', {
    options: ['horizontal', 'vertical'],
  });
  const a11yLabel = def.state.string('a11yLabel', '');
  // P-BASE-TABS-LIST-A11Y-ROLE, P-BASE-TABS-LIST-A11Y-ORIENTATION
  // P-BASE-TABS-LIST-A11Y-LABEL
  accessible.role('tablist');
  accessible.name(a11yLabel);
  accessible.state('orientation', orientation);

  // P-BASE-TABS-LIST-FOCUS-ROVING, P-BASE-TABS-LIST-SKIP-DISABLED
  // P-BASE-TABS-LIST-ORIENTATION-KEYS, P-BASE-TABS-LIST-HOME-END
  const focusRoving = asFocusRoving<TabsListProps>();
  focusRoving.configure({
    navigation: 'arrow',
    orientation: 'horizontal',
    entry: 'manual',
  });

  // P-BASE-TABS-LIST-FOCUS-METHODS
  def.expose.method('focusFirst', () => focusRoving.focusFirst());
  def.expose.method('focusLast', () => focusRoving.focusLast());
  def.expose.method('focusNext', () => focusRoving.focusNext());
  def.expose.method('focusPrev', () => focusRoving.focusPrev());
  def.expose.method('focusSelected', () => focusRoving.focusSelected());

  def.context.subscribe(TABS_CONTEXT, (_run, next) => {
    // P-BASE-TABS-LIST-CONTEXT-CONSUME
    const nextOrientation = next.orientation ?? 'horizontal';
    orientation.set(nextOrientation, 'reason: tabs list context orientation sync');
    focusRoving.setOrientation(nextOrientation);
  });

  def.lifecycle.onMounted((run) => {
    const ctx = run.context.read(TABS_CONTEXT);
    const nextOrientation = ctx.orientation ?? 'horizontal';
    orientation.set(nextOrientation, 'reason: tabs list mounted orientation sync');
    focusRoving.setOrientation(nextOrientation);
    focusRoving.setLoop(!!run.props.get().loop);
    a11yLabel.set(run.props.get().a11yLabel ?? '', 'reason: tabs list mounted a11y label sync');
  });

  def.props.watch(['loop', 'a11yLabel'], (_run, next) => {
    focusRoving.setLoop(!!next.loop);
    a11yLabel.set(next.a11yLabel ?? '', 'reason: tabs list props a11y label sync');
  });
}

// P-BASE-TABS-LIST-AUTHORING-ENTRIES
export const asTabsList = defineAsHook<TabsListProps, TabsListExposes, TabsListAsHookContract>({
  name: 'as-tabs-list',
  setup: setupTabsList,
});

const tabsList = definePrototype({
  name: 'base-tabs-list',
  setup: setupTabsList,
});

export default tabsList;
