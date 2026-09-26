import { describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  TABS_FAMILY,
  tabsContent,
  tabsIndicator,
  tabsList,
  tabsRoot,
  tabsTrigger,
} from '../src/tabs';

AdaptToWebComponent(tabsRoot as any);
AdaptToWebComponent(tabsList as any);
AdaptToWebComponent(tabsTrigger as any);
AdaptToWebComponent(tabsContent as any);
AdaptToWebComponent(tabsIndicator as any);

async function waitForFrameCondition(predicate: () => boolean, maxFrames = 20): Promise<void> {
  for (let frame = 0; frame < maxFrames; frame += 1) {
    if (predicate()) return;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  throw new Error('Timed out waiting for frame condition.');
}

function createRelationshipTabs(keys: string[], contentKeys = keys, keepMounted = true) {
  const root = document.createElement('base-tabs-root') as any;
  const list = document.createElement('base-tabs-list');
  setElementProps(root, { defaultValue: keys[0] });
  const triggers = keys.map((value) => {
    const trigger = document.createElement('base-tabs-trigger') as any;
    setElementProps(trigger, { value });
    list.appendChild(trigger);
    return trigger;
  });
  const contents = contentKeys.map((value) => {
    const content = document.createElement('base-tabs-content') as any;
    setElementProps(content, { value, keepMounted });
    return content;
  });
  root.append(list, ...contents);
  return { root, triggers, contents };
}

describe('prototypes/base: tabs', () => {
  it('matches exact relationship keys and fails closed for missing or duplicate content', async () => {
    // T-A11Y-PART-RELATIONSHIP-0001-CASE-FAIL-CLOSED-RESOLUTION
    // T-A11Y-PART-RELATIONSHIP-0001-CASE-TABS-MIGRATION
    const { root, triggers, contents } = createRelationshipTabs(
      ['a+b', 'a b', 'missing', 'duplicate'],
      ['a+b', 'a b', 'duplicate', 'duplicate']
    );
    try {
      document.body.appendChild(root);
      await Promise.resolve();
      await Promise.resolve();

      expect(root.getExposes().value.get()).toBe('a+b');
      expect(contents[0].id).not.toBe('');
      expect(contents[1].id).not.toBe('');
      expect(contents[0].id).not.toBe(contents[1].id);
      for (const index of [0, 1]) {
        expect(triggers[index].getAttribute('aria-controls')).toBe(contents[index].id);
        expect(contents[index].getAttribute('aria-labelledby')).toBe(triggers[index].id);
      }
      expect(triggers[2].hasAttribute('aria-controls')).toBe(false);
      expect(triggers[3].hasAttribute('aria-controls')).toBe(false);

      contents[3].remove();
      await waitForFrameCondition(() => !!triggers[3].getAttribute('aria-controls'));
      expect(triggers[3].getAttribute('aria-controls')).toBe(contents[2].id);
    } finally {
      root.remove();
      await Promise.resolve();
      await Promise.resolve();
    }
  });

  it('keeps same-key relationships inside adjacent and nested Tabs domains', async () => {
    // T-A11Y-PART-RELATIONSHIP-0001-CASE-FAIL-CLOSED-RESOLUTION
    const outer = createRelationshipTabs(['shared']);
    const nested = createRelationshipTabs(['shared']);
    const adjacent = createRelationshipTabs(['shared']);
    const host = document.createElement('div');
    outer.root.appendChild(nested.root);
    host.append(outer.root, adjacent.root);
    try {
      document.body.appendChild(host);
      await Promise.resolve();
      await Promise.resolve();

      const ids = [outer, nested, adjacent].map(({ triggers, contents }) => {
        expect(contents[0].id).not.toBe('');
        expect(triggers[0].getAttribute('aria-controls')).toBe(contents[0].id);
        expect(contents[0].getAttribute('aria-labelledby')).toBe(triggers[0].id);
        return contents[0].id;
      });
      expect(new Set(ids).size).toBe(3);
    } finally {
      host.remove();
      await Promise.resolve();
      await Promise.resolve();
    }
  });

  it('withdraws lazy panel IDREFs and restores the same identity after rematerialization', async () => {
    // T-A11Y-PART-RELATIONSHIP-0001-CASE-VIEW-EPOCH-LIFECYCLE
    // T-A11Y-PART-RELATIONSHIP-0001-CASE-TABS-MIGRATION
    const { root, triggers, contents } = createRelationshipTabs(['a', 'b'], ['a', 'b'], false);
    try {
      document.body.appendChild(root);
      await waitForFrameCondition(() => contents[0].tabIndex === 0);
      const firstId = contents[0].id;
      expect(firstId).not.toBe('');
      expect(triggers[0].getAttribute('aria-controls')).toBe(firstId);
      expect(triggers[1].hasAttribute('aria-controls')).toBe(false);

      triggers[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await waitForFrameCondition(() => contents[1].tabIndex === 0);
      expect(root.getExposes().value.get()).toBe('b');
      expect(contents[0].getExposes().hidden.get()).toBe(true);
      expect(triggers[0].hasAttribute('aria-controls')).toBe(false);
      expect(triggers[1].getAttribute('aria-controls')).toBe(contents[1].id);

      triggers[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await waitForFrameCondition(() => contents[0].tabIndex === 0);
      expect(root.getExposes().value.get()).toBe('a');
      expect(contents[0].id).toBe(firstId);
      expect(triggers[0].getAttribute('aria-controls')).toBe(firstId);
      expect(contents[0].getAttribute('aria-labelledby')).toBe(triggers[0].id);
      expect(triggers[1].hasAttribute('aria-controls')).toBe(false);
    } finally {
      root.remove();
      await Promise.resolve();
      await Promise.resolve();
    }
  });

  it('declares tabs anatomy family including optional indicator', () => {
    // T-BASE-TABS-0001-CASE-ANATOMY-FAMILY
    expect(TABS_FAMILY.debugName).toBe('base-tabs');
    expect(TABS_FAMILY.decl.roles.root.cardinality).toEqual({ min: 1, max: 1 });
    expect(TABS_FAMILY.decl.roles.list.cardinality).toEqual({ min: 0, max: 1 });
    expect(TABS_FAMILY.decl.roles.trigger.cardinality).toEqual({ min: 0, max: 100 });
    expect(TABS_FAMILY.decl.roles.content.cardinality).toEqual({ min: 0, max: 100 });
    expect(TABS_FAMILY.decl.roles.indicator.cardinality).toEqual({ min: 0, max: '*' });
    expect(TABS_FAMILY.decl.relations).toEqual([
      { kind: 'contains', parent: 'root', child: 'list' },
      { kind: 'contains', parent: 'list', child: 'trigger' },
      { kind: 'contains', parent: 'root', child: 'content' },
      { kind: 'contains', parent: 'root', child: 'indicator' },
    ]);
  });

  it('tabs root, trigger, and content stay in sync in uncontrolled mode', async () => {
    // T-BASE-TABS-0001-CASE-UNCONTROLLED-VALUE-CHANGE
    // T-BASE-TABS-TRIGGER-0001-CASE-SELECTION
    // T-BASE-TABS-CONTENT-0001-CASE-HIDDEN
    // T-BASE-TABS-0001-CASE-A11Y-RELATIONS
    const root = document.createElement('base-tabs-root') as any;
    const list = document.createElement('base-tabs-list') as any;
    const triggerA = document.createElement('base-tabs-trigger') as any;
    const triggerB = document.createElement('base-tabs-trigger') as any;
    const contentA = document.createElement('base-tabs-content') as any;
    const contentB = document.createElement('base-tabs-content') as any;
    const valueChanges: Array<{ value: string }> = [];
    root.addEventListener('valueChange', (event: Event) => {
      valueChanges.push((event as CustomEvent).detail);
    });

    setElementProps(root, { defaultValue: 'a' });
    setElementProps(list, { a11yLabel: 'Account sections' });
    setElementProps(triggerA, { value: 'a' });
    setElementProps(triggerB, { value: 'b' });
    setElementProps(contentA, { value: 'a' });
    setElementProps(contentB, { value: 'b' });

    list.appendChild(triggerA);
    list.appendChild(triggerB);
    root.appendChild(list);
    root.appendChild(contentA);
    root.appendChild(contentB);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    expect(root.getExposes().value.get()).toBe('a');
    expect(triggerA.getExposes().selected.get()).toBe(true);
    expect(triggerB.getExposes().selected.get()).toBe(false);
    expect(contentA.getExposes().current.get()).toBe(true);
    expect(contentB.getExposes().current.get()).toBe(false);
    expect(contentA.getExposes().hidden.get()).toBe(false);
    expect(contentB.getExposes().hidden.get()).toBe(true);
    expect(contentA.hasAttribute('hidden')).toBe(false);
    // The inactive panel has no view by default, so its persistent WC owner
    // shell does not need an additional projected hidden attribute.
    expect(contentB.hasAttribute('hidden')).toBe(false);
    expect(contentA.tabIndex).toBe(0);
    expect(contentB.tabIndex).toBe(-1);
    expect(list.getAttribute('role')).toBe('tablist');
    expect(list.getAttribute('aria-label')).toBe('Account sections');
    expect(list.getAttribute('aria-orientation')).toBe('horizontal');
    expect(triggerA.getAttribute('role')).toBe('tab');
    expect(triggerA.getAttribute('aria-selected')).toBe('true');
    expect(triggerB.getAttribute('aria-selected')).toBe('false');
    expect(contentA.getAttribute('role')).toBe('tabpanel');
    expect(triggerA.getAttribute('aria-controls')).toBe(contentA.getAttribute('id'));
    expect(contentA.getAttribute('aria-labelledby')).toBe(triggerA.getAttribute('id'));

    triggerB.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await waitForFrameCondition(() => contentB.tabIndex === 0);

    expect(root.getExposes().value.get()).toBe('b');
    expect(valueChanges).toEqual([{ value: 'b' }]);
    expect(triggerA.getExposes().selected.get()).toBe(false);
    expect(triggerB.getExposes().selected.get()).toBe(true);
    expect(contentA.getExposes().current.get()).toBe(false);
    expect(contentB.getExposes().current.get()).toBe(true);
    expect(contentA.getExposes().hidden.get()).toBe(true);
    expect(contentB.getExposes().hidden.get()).toBe(false);
    expect(contentA.hasAttribute('hidden')).toBe(true);
    expect(contentB.hasAttribute('hidden')).toBe(false);
    expect(contentA.tabIndex).toBe(-1);
    expect(contentB.tabIndex).toBe(0);

    root.remove();
    await Promise.resolve();
  });

  it('uncontrolled tabs falls back to the first enabled trigger when selection is invalid', async () => {
    // T-BASE-TABS-0001-CASE-SELECTION-FALLBACK
    const root = document.createElement('base-tabs-root') as any;
    const triggerA = document.createElement('base-tabs-trigger') as any;
    const triggerB = document.createElement('base-tabs-trigger') as any;
    const triggerC = document.createElement('base-tabs-trigger') as any;
    const contentB = document.createElement('base-tabs-content') as any;
    const contentC = document.createElement('base-tabs-content') as any;

    setElementProps(root, { defaultValue: 'missing' });
    setElementProps(triggerA, { value: 'a', disabled: true });
    setElementProps(triggerB, { value: 'b' });
    setElementProps(triggerC, { value: 'c' });
    setElementProps(contentB, { value: 'b' });
    setElementProps(contentC, { value: 'c' });

    root.append(triggerA, triggerB, triggerC, contentB, contentC);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    expect(root.getExposes().value.get()).toBe('b');
    expect(triggerA.getExposes().selected.get()).toBe(false);
    expect(triggerB.getExposes().selected.get()).toBe(true);
    expect(triggerC.getExposes().selected.get()).toBe(false);
    expect(contentB.getExposes().current.get()).toBe(true);

    setElementProps(triggerB, { value: 'b', disabled: true });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(root.getExposes().value.get()).toBe('c');
    expect(triggerB.getExposes().selected.get()).toBe(false);
    expect(triggerC.getExposes().selected.get()).toBe(true);
    expect(contentB.getExposes().current.get()).toBe(false);
    expect(contentC.getExposes().current.get()).toBe(true);

    root.remove();
    await Promise.resolve();
  });

  it('current tab content delegates focus entry to tabbable descendants before self fallback', async () => {
    // T-BASE-TABS-CONTENT-0001-CASE-FOCUS-ENTRY
    const root = document.createElement('base-tabs-root') as any;
    const contentA = document.createElement('base-tabs-content') as any;
    const contentB = document.createElement('base-tabs-content') as any;
    const innerButton = document.createElement('button');

    setElementProps(root, { defaultValue: 'a' });
    setElementProps(contentA, { value: 'a' });
    setElementProps(contentB, { value: 'b' });

    contentA.appendChild(innerButton);
    root.append(contentA, contentB);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    expect(contentA.getExposes().current.get()).toBe(true);
    expect(contentA.tabIndex).toBe(-1);
    expect(contentB.tabIndex).toBe(-1);

    root.remove();
    await Promise.resolve();
  });

  it('controlled tabs root synchronizes from props updates', async () => {
    // T-BASE-TABS-0001-CASE-CONTROLLED-VALUE
    const root = document.createElement('base-tabs-root') as any;
    const triggerA = document.createElement('base-tabs-trigger') as any;
    const triggerB = document.createElement('base-tabs-trigger') as any;

    setElementProps(root, { value: 'b' });
    setElementProps(triggerA, { value: 'a' });
    setElementProps(triggerB, { value: 'b' });

    root.appendChild(triggerA);
    root.appendChild(triggerB);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    expect(root.getExposes().value.get()).toBe('b');
    setElementProps(root, { value: 'a' });
    await Promise.resolve();
    expect(root.getExposes().value.get()).toBe('a');
    expect(triggerA.getExposes().selected.get()).toBe(true);
    expect(triggerB.getExposes().selected.get()).toBe(false);

    root.remove();
    await Promise.resolve();
  });

  it('disabled trigger does not change the selected tab', async () => {
    // T-BASE-TABS-TRIGGER-0001-CASE-DISABLED-GATING
    const root = document.createElement('base-tabs-root') as any;
    const triggerA = document.createElement('base-tabs-trigger') as any;
    const triggerB = document.createElement('base-tabs-trigger') as any;

    setElementProps(root, { defaultValue: 'a' });
    setElementProps(triggerA, { value: 'a' });
    setElementProps(triggerB, { value: 'b', disabled: true });

    root.appendChild(triggerA);
    root.appendChild(triggerB);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    triggerB.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(root.getExposes().value.get()).toBe('a');
    expect(triggerA.getExposes().selected.get()).toBe(true);
    expect(triggerB.getExposes().selected.get()).toBe(false);

    root.remove();
    await Promise.resolve();
  });

  it('arrow key roving moves focus and selection across triggers in automatic mode', async () => {
    // T-BASE-TABS-LIST-0001-CASE-ROVING-AUTOMATIC
    const root = document.createElement('base-tabs-root') as any;
    const list = document.createElement('base-tabs-list') as any;
    const triggerA = document.createElement('base-tabs-trigger') as any;
    const triggerB = document.createElement('base-tabs-trigger') as any;

    setElementProps(root, {
      defaultValue: 'a',
      orientation: 'horizontal',
      activationMode: 'automatic',
    });
    setElementProps(triggerA, { value: 'a' });
    setElementProps(triggerB, { value: 'b' });

    list.appendChild(triggerA);
    list.appendChild(triggerB);
    root.appendChild(list);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    expect(triggerA.tabIndex).toBe(0);
    expect(triggerB.tabIndex).toBe(-1);
    expect(triggerB.getAttribute('tabindex')).toBe('-1');

    triggerA.focus();
    // T-BASE-TABS-TRIGGER-0001-CASE-KEYBOARD
    const spaceEvent = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
    window.dispatchEvent(spaceEvent);
    await Promise.resolve();
    expect(spaceEvent.defaultPrevented).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }));
    await Promise.resolve();

    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    window.dispatchEvent(tabEvent);
    await Promise.resolve();

    expect(tabEvent.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(triggerA);
    expect(triggerA.tabIndex).toBe(0);
    expect(triggerB.tabIndex).toBe(-1);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    await Promise.resolve();
    await Promise.resolve();

    expect(document.activeElement).toBe(triggerB);
    expect(root.getExposes().value.get()).toBe('b');
    expect(triggerB.getExposes().selected.get()).toBe(true);
    expect(triggerA.tabIndex).toBe(-1);
    expect(triggerB.tabIndex).toBe(0);

    root.remove();
    await Promise.resolve();
  });

  it('manual activation mode keeps selection stable while roving focus, then commits on click', async () => {
    // T-BASE-TABS-LIST-0001-CASE-ROVING-MANUAL
    const root = document.createElement('base-tabs-root') as any;
    const list = document.createElement('base-tabs-list') as any;
    const triggerA = document.createElement('base-tabs-trigger') as any;
    const triggerB = document.createElement('base-tabs-trigger') as any;
    const triggerC = document.createElement('base-tabs-trigger') as any;
    const contentA = document.createElement('base-tabs-content') as any;
    const contentB = document.createElement('base-tabs-content') as any;
    const contentC = document.createElement('base-tabs-content') as any;

    setElementProps(root, {
      defaultValue: 'a',
      orientation: 'horizontal',
      activationMode: 'manual',
    });
    setElementProps(triggerA, { value: 'a' });
    setElementProps(triggerB, { value: 'b' });
    setElementProps(triggerC, { value: 'c' });
    setElementProps(contentA, { value: 'a' });
    setElementProps(contentB, { value: 'b' });
    setElementProps(contentC, { value: 'c' });

    list.appendChild(triggerA);
    list.appendChild(triggerB);
    list.appendChild(triggerC);
    root.appendChild(list);
    root.appendChild(contentA);
    root.appendChild(contentB);
    root.appendChild(contentC);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    expect(triggerA.tabIndex).toBe(0);
    expect(triggerB.tabIndex).toBe(-1);
    expect(triggerC.tabIndex).toBe(-1);

    triggerA.focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    await Promise.resolve();
    await Promise.resolve();

    expect(document.activeElement).toBe(triggerB);
    expect(root.getExposes().value.get()).toBe('a');
    expect(triggerA.getExposes().selected.get()).toBe(true);
    expect(triggerB.getExposes().selected.get()).toBe(false);
    expect(triggerA.tabIndex).toBe(-1);
    expect(triggerB.tabIndex).toBe(0);
    expect(triggerC.tabIndex).toBe(-1);

    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    window.dispatchEvent(tabEvent);
    await Promise.resolve();

    expect(tabEvent.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(triggerB);
    expect(root.getExposes().value.get()).toBe('a');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    await Promise.resolve();
    await Promise.resolve();

    expect(document.activeElement).toBe(triggerC);
    expect(root.getExposes().value.get()).toBe('a');
    expect(triggerA.tabIndex).toBe(-1);
    expect(triggerB.tabIndex).toBe(-1);
    expect(triggerC.tabIndex).toBe(0);

    list.getExposes().focusSelected();
    await Promise.resolve();
    await Promise.resolve();

    expect(document.activeElement).toBe(triggerA);
    expect(root.getExposes().value.get()).toBe('a');

    triggerC.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();

    expect(root.getExposes().value.get()).toBe('c');
    expect(triggerC.getExposes().selected.get()).toBe(true);
    expect(contentC.getExposes().current.get()).toBe(true);

    root.remove();
    await Promise.resolve();
  });

  it('vertical tabs use focus roving for arrow-key navigation without trigger-owned forwarding', async () => {
    // T-BASE-TABS-LIST-0001-CASE-ROVING-ORIENTATION
    const root = document.createElement('base-tabs-root') as any;
    const list = document.createElement('base-tabs-list') as any;
    const triggerA = document.createElement('base-tabs-trigger') as any;
    const triggerB = document.createElement('base-tabs-trigger') as any;

    setElementProps(root, {
      defaultValue: 'a',
      orientation: 'vertical',
      activationMode: 'automatic',
    });
    setElementProps(triggerA, { value: 'a' });
    setElementProps(triggerB, { value: 'b' });

    list.appendChild(triggerA);
    list.appendChild(triggerB);
    root.appendChild(list);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    triggerA.focus();
    const ignored = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });
    window.dispatchEvent(ignored);
    await Promise.resolve();

    expect(ignored.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(triggerA);
    expect(root.getExposes().value.get()).toBe('a');

    const handled = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true });
    window.dispatchEvent(handled);
    await Promise.resolve();
    await Promise.resolve();

    expect(handled.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(triggerB);
    expect(root.getExposes().value.get()).toBe('b');
    expect(triggerA.tabIndex).toBe(-1);
    expect(triggerB.tabIndex).toBe(0);

    root.remove();
    await Promise.resolve();
  });

  it('indicator consumes tabs context without interaction or focus surfaces', async () => {
    // T-BASE-TABS-INDICATOR-0001-CASE-CONTEXT-CONSUMPTION
    // T-BASE-TABS-INDICATOR-0001-CASE-NO-INTERACTION-SURFACES
    const root = document.createElement('base-tabs-root') as any;
    const triggerA = document.createElement('base-tabs-trigger') as any;
    const triggerB = document.createElement('base-tabs-trigger') as any;
    const indicator = document.createElement('base-tabs-indicator') as any;

    setElementProps(root, { defaultValue: 'a', orientation: 'vertical' });
    setElementProps(triggerA, { value: 'a' });
    setElementProps(triggerB, { value: 'b' });

    root.append(triggerA, triggerB, indicator);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    const exposes = indicator.getExposes();
    expect(exposes.value.get()).toBe('a');
    expect(exposes.activeValue.get()).toBe('a');
    expect(exposes.orientation.get()).toBe('vertical');
    expect(exposes.valueChange).toBeUndefined();
    expect(exposes.focusSelf).toBeUndefined();
    expect(indicator.getAttribute('role')).toBeNull();

    triggerB.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(exposes.value.get()).toBe('b');
    expect(exposes.activeValue.get()).toBe('b');

    root.remove();
    await Promise.resolve();
  });
});
