import { afterEach, describe, expect, it } from 'vitest';
import * as radioGroupModule from '../src/radio-group';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  RADIO_GROUP_FAMILY,
  radioGroupIndicator,
  radioGroupItem,
  radioGroupRoot,
} from '../src/radio-group';

type ReadState<T> = { get(): T };
type CollectionSnapshot = Readonly<
  Record<string, unknown> & {
    index: number;
    total: number;
    first: boolean;
    last: boolean;
  }
>;

type RootExposes = {
  value: ReadState<string>;
  disabled: ReadState<boolean>;
  count: ReadState<number>;
  requestValue(value: string): boolean;
  getCollectionItems(): readonly CollectionSnapshot[];
  getCollectionCount(): number;
  focusFirst(): void;
  focusLast(): void;
  focusNext(): void;
  focusPrev(): void;
  focusSelected(): void;
};

type ItemExposes = {
  checked: ReadState<boolean>;
  disabled: ReadState<boolean>;
  hovered: ReadState<boolean>;
  focused: ReadState<boolean>;
  focusVisible: ReadState<boolean>;
  pressed: ReadState<boolean>;
  focusSelf(): void;
};

type IndicatorExposes = {
  checked: ReadState<boolean>;
  disabled: ReadState<boolean>;
  isChecked(): boolean;
};

type ProtoElement<E> = HTMLElement & { getExposes(): E };
type RootElement = ProtoElement<RootExposes>;
type ItemElement = ProtoElement<ItemExposes>;
type IndicatorElement = ProtoElement<IndicatorExposes>;

AdaptToWebComponent(radioGroupRoot);
AdaptToWebComponent(radioGroupItem);
AdaptToWebComponent(radioGroupIndicator);

function rootElement(): RootElement {
  return document.createElement('base-radio-group-root') as RootElement;
}

function itemElement(value: string, disabled = false): ItemElement {
  const item = document.createElement('base-radio-group-item') as ItemElement;
  setElementProps(item, { value, disabled });
  item.textContent = value;
  return item;
}

function indicatorElement(): IndicatorElement {
  return document.createElement('base-radio-group-indicator') as IndicatorElement;
}

async function flushReconciliation(): Promise<void> {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

afterEach(async () => {
  document.body.replaceChildren();
  await flushReconciliation();
});

describe('prototypes/base: radio group', () => {
  it('declares one group root with repeatable items and optional repeatable indicators', () => {
    expect(RADIO_GROUP_FAMILY.debugName).toBe('base-radio-group');
    expect(RADIO_GROUP_FAMILY.decl.roles.root.cardinality).toEqual({ min: 1, max: 1 });
    expect(RADIO_GROUP_FAMILY.decl.roles.item.cardinality).toEqual({ min: 1, max: 100 });
    expect(RADIO_GROUP_FAMILY.decl.roles.indicator.cardinality).toEqual({ min: 0, max: '*' });
    expect(RADIO_GROUP_FAMILY.decl.relations).toEqual([
      { kind: 'contains', parent: 'root', child: 'item' },
      { kind: 'contains', parent: 'item', child: 'indicator' },
    ]);
  });

  it('preserves empty and unmatched values without inventing a selection', async () => {
    const root = rootElement();
    const itemA = itemElement('a');
    const itemB = itemElement('b');
    setElementProps(root, { a11yLabel: 'Delivery method' });
    root.append(itemA, itemB);
    document.body.append(root);
    await flushReconciliation();

    expect(root.getExposes().value.get()).toBe('');
    expect(itemA.getExposes().checked.get()).toBe(false);
    expect(itemB.getExposes().checked.get()).toBe(false);
    expect(root.getAttribute('role')).toBe('radiogroup');
    expect(root.getAttribute('aria-label')).toBe('Delivery method');
    expect(itemA.getAttribute('role')).toBe('radio');
    expect(itemA.getAttribute('aria-checked')).toBe('false');
    expect(itemA.tabIndex).toBe(0);
    expect(itemB.tabIndex).toBe(-1);

    setElementProps(root, { value: 'missing' });
    await flushReconciliation();
    expect(root.getExposes().value.get()).toBe('missing');
    expect(itemA.getExposes().checked.get()).toBe(false);
    expect(itemB.getExposes().checked.get()).toBe(false);
  });

  it.each([
    { props: { defaultValue: 'b' }, disabledItem: '', value: 'b', entry: 'b' },
    { props: { value: 'b' }, disabledItem: '', value: 'b', entry: 'b' },
    { props: {}, disabledItem: 'a', value: '', entry: 'b' },
    { props: { value: 'missing' }, disabledItem: 'a', value: 'missing', entry: 'b' },
    { props: { defaultValue: 'b' }, disabledItem: 'b', value: 'b', entry: 'a' },
  ])('derives initial entry from selection and enabled order: %j', async (scenario) => {
    const root = rootElement();
    const items = ['a', 'b', 'c'].map((value) =>
      itemElement(value, value === scenario.disabledItem)
    );
    const changes: string[] = [];
    const previousFocus = document.activeElement;
    root.addEventListener('valueChange', (event) => {
      changes.push((event as CustomEvent<{ value: string }>).detail.value);
    });
    setElementProps(root, scenario.props);
    root.append(...items);
    document.body.append(root);
    await flushReconciliation();

    expect(root.getExposes().getCollectionCount()).toBe(3);
    expect(root.getExposes().value.get()).toBe(scenario.value);
    for (const item of items) {
      expect(item.tabIndex).toBe(item.textContent === scenario.entry ? 0 : -1);
      expect(item.getExposes().checked.get()).toBe(item.textContent === scenario.value);
    }
    expect(document.activeElement).toBe(previousFocus);
    expect(changes).toEqual([]);
  });

  it('recomputes provisional entry when selected items register and collection order changes', async () => {
    const root = rootElement();
    const itemA = itemElement('a');
    const itemB = itemElement('b');
    const itemC = itemElement('c');
    const changes: string[] = [];
    root.addEventListener('valueChange', (event) => {
      changes.push((event as CustomEvent<{ value: string }>).detail.value);
    });
    setElementProps(root, { value: 'b' });
    root.append(itemA, itemC);
    document.body.append(root);
    await flushReconciliation();
    expect(itemA.tabIndex).toBe(0);

    root.insertBefore(itemB, itemC);
    await flushReconciliation();
    expect([itemA.tabIndex, itemB.tabIndex, itemC.tabIndex]).toEqual([-1, 0, -1]);
    expect(itemB.getExposes().checked.get()).toBe(true);

    itemB.remove();
    await flushReconciliation();
    expect(itemA.tabIndex).toBe(0);
    root.insertBefore(itemC, itemA);
    await expect.poll(() => [itemC.tabIndex, itemA.tabIndex]).toEqual([0, -1]);

    root.append(itemB);
    await flushReconciliation();
    expect([itemC.tabIndex, itemA.tabIndex, itemB.tabIndex]).toEqual([-1, -1, 0]);
    expect(itemB.getExposes().checked.get()).toBe(true);

    setElementProps(itemB, { value: 'renamed' });
    await flushReconciliation();
    expect([itemC.tabIndex, itemA.tabIndex, itemB.tabIndex]).toEqual([0, -1, -1]);
    setElementProps(itemB, { value: 'b' });
    await flushReconciliation();
    expect([itemC.tabIndex, itemA.tabIndex, itemB.tabIndex]).toEqual([-1, -1, 0]);
    expect(root.getExposes().value.get()).toBe('b');
    expect(changes).toEqual([]);
  });

  it('owns uncontrolled requests and emits one accepted change per new selection', async () => {
    const root = rootElement();
    const itemA = itemElement('a');
    const itemB = itemElement('b');
    const itemC = itemElement('c', true);
    const changes: string[] = [];
    const itemSelections: string[] = [];
    root.addEventListener('valueChange', (event) => {
      changes.push((event as CustomEvent<{ value: string }>).detail.value);
    });
    itemB.addEventListener('select', (event) => {
      itemSelections.push((event as CustomEvent<{ value: string }>).detail.value);
    });
    setElementProps(root, { defaultValue: 'a' });
    root.append(itemA, itemB, itemC);
    document.body.append(root);
    await flushReconciliation();

    expect(root.getExposes().requestValue('b')).toBe(true);
    await flushReconciliation();
    expect(root.getExposes().value.get()).toBe('b');
    expect(itemA.getExposes().checked.get()).toBe(false);
    expect(itemB.getExposes().checked.get()).toBe(true);
    expect(changes).toEqual(['b']);

    setElementProps(root, { a11yLabel: 'Updated group name' });
    await flushReconciliation();
    expect([itemA.tabIndex, itemB.tabIndex, itemC.tabIndex]).toEqual([-1, 0, -1]);

    expect(root.getExposes().requestValue('b')).toBe(false);
    expect(root.getExposes().requestValue('')).toBe(false);
    expect(root.getExposes().requestValue('missing')).toBe(false);
    expect(root.getExposes().requestValue('c')).toBe(false);
    expect(changes).toEqual(['b']);

    itemA.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushReconciliation();
    expect(root.getExposes().value.get()).toBe('a');
    expect(changes).toEqual(['b', 'a']);
    expect(itemSelections).toEqual([]);

    itemB.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushReconciliation();
    expect(itemSelections).toEqual(['b']);
  });

  it('signals controlled requests without mutating final checked state', async () => {
    const root = rootElement();
    const itemA = itemElement('a');
    const itemB = itemElement('b');
    const changes: string[] = [];
    root.addEventListener('valueChange', (event) => {
      changes.push((event as CustomEvent<{ value: string }>).detail.value);
    });
    setElementProps(root, { value: 'a' });
    root.append(itemA, itemB);
    document.body.append(root);
    await flushReconciliation();

    itemB.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushReconciliation();
    expect(changes).toEqual(['b']);
    expect(root.getExposes().value.get()).toBe('a');
    expect(itemA.getExposes().checked.get()).toBe(true);
    expect(itemB.getExposes().checked.get()).toBe(false);

    setElementProps(root, { a11yLabel: 'Updated group name' });
    await flushReconciliation();
    expect([itemA.tabIndex, itemB.tabIndex]).toEqual([-1, 0]);

    setElementProps(root, { value: 'b' });
    await flushReconciliation();
    expect(root.getExposes().value.get()).toBe('b');
    expect(itemA.getExposes().checked.get()).toBe(false);
    expect(itemB.getExposes().checked.get()).toBe(true);
    expect(changes).toEqual(['b']);
  });

  it('contains duplicate authoring to one checked item and rejects ambiguous requests', async () => {
    const root = rootElement();
    const first = itemElement('duplicate');
    const second = itemElement('duplicate');
    setElementProps(root, { defaultValue: 'duplicate' });
    root.append(first, second);
    document.body.append(root);
    await flushReconciliation();

    expect(first.getExposes().checked.get()).toBe(true);
    expect(second.getExposes().checked.get()).toBe(false);
    expect(root.querySelectorAll('[aria-checked="true"]')).toHaveLength(1);
    expect(root.getExposes().requestValue('duplicate')).toBe(false);
  });

  it('preserves value across structural churn and selected-item disablement', async () => {
    const root = rootElement();
    const itemA = itemElement('a');
    const itemB = itemElement('b');
    const changes: string[] = [];
    root.addEventListener('valueChange', (event) => {
      changes.push((event as CustomEvent<{ value: string }>).detail.value);
    });
    setElementProps(root, { defaultValue: 'b' });
    root.append(itemA, itemB);
    document.body.append(root);
    await flushReconciliation();

    itemB.remove();
    await flushReconciliation();
    expect(root.getExposes().value.get()).toBe('b');
    expect(itemA.getExposes().checked.get()).toBe(false);
    expect(changes).toEqual([]);

    root.append(itemB);
    await flushReconciliation();
    expect(itemB.getExposes().checked.get()).toBe(true);

    setElementProps(itemB, { value: 'b', disabled: true });
    await flushReconciliation();
    expect(root.getExposes().value.get()).toBe('b');
    expect(itemB.getExposes().checked.get()).toBe(true);
    expect(itemB.getExposes().disabled.get()).toBe(true);
    expect(itemB.getAttribute('aria-disabled')).toBe('true');
    expect(itemB.tabIndex).toBe(-1);
    expect(itemA.tabIndex).toBe(0);
    expect(changes).toEqual([]);
  });

  it('selects with Space and pointer commit but not Enter or canceled pointer input', async () => {
    const root = rootElement();
    const itemA = itemElement('a');
    const itemB = itemElement('b');
    setElementProps(root, { defaultValue: 'a' });
    root.append(itemA, itemB);
    document.body.append(root);
    await flushReconciliation();

    itemB.getExposes().focusSelf();
    await flushReconciliation();
    expect(document.activeElement).toBe(itemB);
    expect(root.getExposes().value.get()).toBe('a');

    const space = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
    window.dispatchEvent(space);
    await flushReconciliation();
    expect(space.defaultPrevented).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }));
    await flushReconciliation();
    expect(root.getExposes().value.get()).toBe('b');

    itemA.getExposes().focusSelf();
    await flushReconciliation();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));
    await flushReconciliation();
    expect(root.getExposes().value.get()).toBe('b');

    itemA.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    itemA.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true }));
    await flushReconciliation();
    expect(root.getExposes().value.get()).toBe('b');
    expect(itemA.getExposes().pressed.get()).toBe(false);

    itemA.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushReconciliation();
    expect(root.getExposes().value.get()).toBe('a');
  });

  it.each(['a', 'b'])(
    'preserves programmatic current focus across unrelated root updates',
    async (currentValue) => {
      const root = rootElement();
      const itemA = itemElement('a');
      const itemB = itemElement('b');
      const itemC = itemElement('c');
      const current = currentValue === 'a' ? itemA : itemB;
      const changes: string[] = [];
      root.addEventListener('valueChange', (event) => {
        changes.push((event as CustomEvent<{ value: string }>).detail.value);
      });
      setElementProps(root, { defaultValue: 'a' });
      root.append(itemA, itemB);
      document.body.append(root);
      await flushReconciliation();

      current.getExposes().focusSelf();
      await flushReconciliation();
      expect(root.getExposes().value.get()).toBe('a');
      expect(current.tabIndex).toBe(0);

      setElementProps(root, { a11yLabel: 'Updated group name' });
      await flushReconciliation();
      expect(root.getExposes().value.get()).toBe('a');
      expect(current.tabIndex).toBe(0);

      setElementProps(root, { value: 'c' });
      await flushReconciliation();
      root.append(itemC);
      await flushReconciliation();
      root.insertBefore(itemC, itemA);
      await flushReconciliation();
      expect(root.getExposes().value.get()).toBe('c');
      expect(itemC.getExposes().checked.get()).toBe(true);
      for (const item of [itemA, itemB, itemC]) {
        expect(item.tabIndex).toBe(item === current ? 0 : -1);
      }
      expect(document.activeElement).toBe(current);
      expect(changes).toEqual([]);
    }
  );

  it.each([
    { method: 'focusFirst', value: 'a', current: 0, next: 'b' },
    { method: 'focusSelected', value: 'b', current: 1, next: 'c' },
    { method: 'focusLast', value: 'c', current: 2, next: 'a' },
  ] as const)('retains current established by Root $method', async (scenario) => {
    const root = rootElement();
    const items = ['a', 'b', 'c'].map((value) => itemElement(value));
    const changes: string[] = [];
    root.addEventListener('valueChange', (event) => {
      changes.push((event as CustomEvent<{ value: string }>).detail.value);
    });
    setElementProps(root, { value: scenario.value });
    root.append(...items);
    document.body.append(root);
    await flushReconciliation();

    root.getExposes()[scenario.method]();
    await flushReconciliation();
    expect(document.activeElement).toBe(items[scenario.current]);
    expect(root.getExposes().value.get()).toBe(scenario.value);

    setElementProps(root, { value: scenario.next, a11yLabel: 'Updated group name' });
    await flushReconciliation();
    expect(root.getExposes().value.get()).toBe(scenario.next);
    expect(document.activeElement).toBe(items[scenario.current]);
    expect(items.map((item) => item.tabIndex)).toEqual(
      items.map((_, index) => (index === scenario.current ? 0 : -1))
    );
    expect(items.map((item) => item.getExposes().checked.get())).toEqual(
      items.map((item) => item.textContent === scenario.next)
    );
    expect(changes).toEqual([]);
  });

  it('discards explicit current when its item becomes disabled or leaves the collection', async () => {
    const root = rootElement();
    const itemA = itemElement('a');
    const itemB = itemElement('b');
    const changes: string[] = [];
    root.addEventListener('valueChange', (event) => {
      changes.push((event as CustomEvent<{ value: string }>).detail.value);
    });
    setElementProps(root, { defaultValue: 'a' });
    root.append(itemA, itemB);
    document.body.append(root);
    await flushReconciliation();

    itemB.getExposes().focusSelf();
    await flushReconciliation();
    setElementProps(itemB, { disabled: true });
    await flushReconciliation();
    expect([itemA.tabIndex, itemB.tabIndex]).toEqual([0, -1]);
    setElementProps(itemB, { disabled: false });
    await flushReconciliation();
    expect([itemA.tabIndex, itemB.tabIndex]).toEqual([0, -1]);

    itemB.getExposes().focusSelf();
    await flushReconciliation();
    itemB.remove();
    await flushReconciliation();
    expect(itemA.tabIndex).toBe(0);
    root.append(itemB);
    await flushReconciliation();
    expect([itemA.tabIndex, itemB.tabIndex]).toEqual([0, -1]);
    expect(root.getExposes().value.get()).toBe('a');
    expect(itemA.getExposes().checked.get()).toBe(true);
    expect(changes).toEqual([]);
  });

  it('wraps both arrow axes, supports Home and End, and skips disabled items', async () => {
    const root = rootElement();
    const itemA = itemElement('a');
    const itemB = itemElement('b', true);
    const itemC = itemElement('c');
    setElementProps(root, { defaultValue: 'a' });
    root.append(itemA, itemB, itemC);
    document.body.append(root);
    await flushReconciliation();

    itemA.focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true }));
    await flushReconciliation();
    expect(document.activeElement).toBe(itemC);
    expect(root.getExposes().value.get()).toBe('c');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }));
    await flushReconciliation();
    expect(document.activeElement).toBe(itemA);
    expect(root.getExposes().value.get()).toBe('a');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true }));
    await flushReconciliation();
    expect(document.activeElement).toBe(itemC);
    expect(root.getExposes().value.get()).toBe('c');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true }));
    await flushReconciliation();
    expect(document.activeElement).toBe(itemA);
    expect(root.getExposes().value.get()).toBe('a');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', cancelable: true }));
    await flushReconciliation();
    expect(document.activeElement).toBe(itemC);
    expect(root.getExposes().value.get()).toBe('c');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', cancelable: true }));
    await flushReconciliation();
    expect(document.activeElement).toBe(itemA);
    expect(root.getExposes().value.get()).toBe('a');

    setElementProps(root, { value: 'c' });
    await flushReconciliation();
    expect(document.activeElement).toBe(itemA);
    expect([itemA.tabIndex, itemB.tabIndex, itemC.tabIndex]).toEqual([0, -1, -1]);
    expect(itemC.getExposes().checked.get()).toBe(true);
  });

  it('derives repeatable indicators without creating another control object', async () => {
    const root = rootElement();
    const itemA = itemElement('a');
    const first = indicatorElement();
    const second = indicatorElement();
    itemA.append(first, second);
    setElementProps(root, { defaultValue: 'a', disabled: true });
    root.append(itemA);
    document.body.append(root);
    await flushReconciliation();

    for (const indicator of [first, second]) {
      expect(indicator.getExposes().checked.get()).toBe(true);
      expect(indicator.getExposes().disabled.get()).toBe(true);
      expect(indicator.getExposes().isChecked()).toBe(true);
      expect(indicator.hasAttribute('role')).toBe(false);
      expect(indicator.hasAttribute('tabindex')).toBe(false);
      expect(indicator.querySelector('input')).toBeNull();
    }
  });

  it('publishes only the approved root, item, and indicator protocol surfaces', async () => {
    expect(Object.keys(radioGroupModule).sort()).toEqual([
      'RADIO_GROUP_FAMILY',
      'asRadioGroupIndicator',
      'asRadioGroupItem',
      'asRadioGroupRoot',
      'radioGroupIndicator',
      'radioGroupItem',
      'radioGroupRoot',
    ]);
    const root = rootElement();
    const item = itemElement('a');
    const indicator = indicatorElement();
    item.append(indicator);
    root.append(item);
    document.body.append(root);
    await flushReconciliation();
    // App Maker expose records contain state/value/method surfaces only.
    // `valueChange` and `select` remain declared expose events and are covered
    // by the behavioral event tests above; declarations are not record entries.

    expect(Object.keys(root.getExposes()).sort()).toEqual([
      'count',
      'disabled',
      'focusFirst',
      'focusLast',
      'focusNext',
      'focusPrev',
      'focusSelected',
      'getCollectionCount',
      'getCollectionItems',
      'requestValue',
      'value',
    ]);
    expect(Object.keys(item.getExposes()).sort()).toEqual([
      'checked',
      'collectionFirst',
      'collectionIndex',
      'collectionLast',
      'collectionTotal',
      'disabled',
      'focusSelf',
      'focusVisible',
      'focused',
      'hovered',
      'pressed',
    ]);
    expect(Object.keys(indicator.getExposes()).sort()).toEqual([
      'checked',
      'disabled',
      'isChecked',
    ]);
  });

  it('keeps independent groups and omits deferred form and layout APIs', async () => {
    const firstRoot = rootElement();
    const firstA = itemElement('a');
    const firstB = itemElement('b');
    const secondRoot = rootElement();
    const secondA = itemElement('a');
    const secondB = itemElement('b');
    setElementProps(firstRoot, { defaultValue: 'a' });
    setElementProps(secondRoot, { defaultValue: 'b' });
    firstRoot.append(firstA, firstB);
    secondRoot.append(secondA, secondB);
    document.body.append(firstRoot, secondRoot);
    await flushReconciliation();

    firstB.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushReconciliation();
    expect(firstRoot.getExposes().value.get()).toBe('b');
    expect(secondRoot.getExposes().value.get()).toBe('b');
    expect(secondB.getExposes().checked.get()).toBe(true);

    expect(firstRoot.querySelector('input')).toBeNull();
    expect(firstRoot.hasAttribute('name')).toBe(false);
    expect(firstRoot.hasAttribute('aria-required')).toBe(false);
    expect(firstRoot.hasAttribute('aria-orientation')).toBe(false);
    expect(firstRoot.getAttribute('data-pui-prop-name')).toBeNull();
    expect(firstRoot.getAttribute('data-pui-prop-form')).toBeNull();
    expect(firstRoot.getAttribute('data-pui-prop-required')).toBeNull();
    expect(firstRoot.getAttribute('data-pui-prop-orientation')).toBeNull();
    expect(firstRoot.getAttribute('data-pui-prop-loop')).toBeNull();
  });
});
