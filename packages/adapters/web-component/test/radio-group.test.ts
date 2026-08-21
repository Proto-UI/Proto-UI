import { afterEach, describe, expect, it } from 'vitest';
import { radioGroupIndicator, radioGroupItem, radioGroupRoot } from '../../../prototypes/base/src/radio-group';
import { AdaptToWebComponent } from '../src/adapt';
import { setElementProps } from '../src/props';
import type { WebComponentAdapterElement } from '../src/types';

const ROOT_TAG = 'x-wc-base-radio-group-root';
const ITEM_TAG = 'x-wc-base-radio-group-item';
const INDICATOR_TAG = 'x-wc-base-radio-group-indicator';

type RootElement = WebComponentAdapterElement<typeof radioGroupRoot>;
type ItemElement = WebComponentAdapterElement<typeof radioGroupItem>;
type IndicatorElement = WebComponentAdapterElement<typeof radioGroupIndicator>;

AdaptToWebComponent(radioGroupRoot, { registerAs: ROOT_TAG });
AdaptToWebComponent(radioGroupItem, { registerAs: ITEM_TAG });
AdaptToWebComponent(radioGroupIndicator, { registerAs: INDICATOR_TAG });

function rootElement(): RootElement {
  return document.createElement(ROOT_TAG) as RootElement;
}

function itemElement(value: string, disabled = false): ItemElement {
  const item = document.createElement(ITEM_TAG) as ItemElement;
  setElementProps(item, { value, disabled });
  item.textContent = value;
  return item;
}

function indicatorElement(): IndicatorElement {
  return document.createElement(INDICATOR_TAG) as IndicatorElement;
}

async function flushReconciliation(): Promise<void> {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

function dispatchKey(target: ItemElement, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  target.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
  return event;
}

afterEach(async () => {
  document.body.replaceChildren();
  await flushReconciliation();
});

describe('adapter-web-component: Base radio group projection', () => {
  it('projects group semantics and preserves radio interactions across adapter updates', async () => {
    const root = rootElement();
    const itemA = itemElement('a');
    const itemB = itemElement('b', true);
    const itemC = itemElement('c');
    const indicatorA = indicatorElement();
    const indicatorB = indicatorElement();
    const indicatorC = indicatorElement();
    itemA.append(indicatorA);
    itemB.append(indicatorB);
    itemC.append(indicatorC);
    setElementProps(root, { defaultValue: 'a', a11yLabel: 'Delivery method' });
    root.append(itemA, itemB, itemC);

    const secondRoot = rootElement();
    const secondA = itemElement('a');
    const secondB = itemElement('b', true);
    const secondC = itemElement('c');
    setElementProps(secondRoot, { defaultValue: 'c', a11yLabel: 'Other delivery method' });
    secondRoot.append(secondA, secondB, secondC);

    document.body.append(root, secondRoot);
    await flushReconciliation();

    expect(root.getAttribute('role')).toBe('radiogroup');
    expect(root.getAttribute('aria-label')).toBe('Delivery method');
    expect(root.getAttribute('aria-disabled')).toBe('false');
    expect(itemA.getAttribute('role')).toBe('radio');
    expect(itemA.getAttribute('aria-checked')).toBe('true');
    expect(itemA.getAttribute('aria-disabled')).toBe('false');
    expect(itemA.getExposes().checked.get()).toBe(true);
    expect(itemA.getExposes().disabled.get()).toBe(false);
    expect(itemA.tabIndex).toBe(0);
    expect(itemB.getAttribute('role')).toBe('radio');
    expect(itemB.getAttribute('aria-checked')).toBe('false');
    expect(itemB.getAttribute('aria-disabled')).toBe('true');
    expect(itemB.getExposes().checked.get()).toBe(false);
    expect(itemB.getExposes().disabled.get()).toBe(true);
    expect(itemB.tabIndex).toBe(-1);
    expect(itemC.getAttribute('role')).toBe('radio');
    expect(itemC.getAttribute('aria-checked')).toBe('false');
    expect(itemC.getAttribute('aria-disabled')).toBe('false');
    expect(itemC.getExposes().checked.get()).toBe(false);
    expect(itemC.getExposes().disabled.get()).toBe(false);
    expect(itemC.tabIndex).toBe(-1);

    expect(indicatorA.getExposes().checked.get()).toBe(true);
    expect(indicatorA.getExposes().disabled.get()).toBe(false);
    expect(indicatorB.getExposes().checked.get()).toBe(false);
    expect(indicatorB.getExposes().disabled.get()).toBe(true);
    expect(indicatorC.getExposes().checked.get()).toBe(false);
    expect(indicatorC.getExposes().disabled.get()).toBe(false);
    for (const indicator of [indicatorA, indicatorB, indicatorC]) {
      expect(indicator.getAttribute('role')).toBeNull();
      expect(indicator.hasAttribute('tabindex')).toBe(false);
      expect(indicator.querySelector('[role="radio"], input')).toBeNull();
      expect(indicator.getAttribute('data-pui-a11y-actions')).toBeNull();
      expect(indicator.getAttribute('aria-controls')).toBeNull();
      expect(indicator.getAttribute('aria-checked')).toBeNull();
      expect(indicator.getAttribute('aria-disabled')).toBeNull();
    }

    itemC.getExposes().focusSelf();
    await flushReconciliation();
    expect(document.activeElement).toBe(itemC);
    expect(root.getExposes().value.get()).toBe('a');
    const space = dispatchKey(itemC, ' ');
    await flushReconciliation();
    expect(space.defaultPrevented).toBe(true);
    expect(root.getExposes().value.get()).toBe('c');
    expect(itemA.getExposes().checked.get()).toBe(false);
    expect(itemC.getExposes().checked.get()).toBe(true);

    itemA.getExposes().focusSelf();
    await flushReconciliation();
    const enter = dispatchKey(itemA, 'Enter');
    await flushReconciliation();
    expect(enter.defaultPrevented).toBe(false);
    expect(root.getExposes().value.get()).toBe('c');
    expect(itemA.getExposes().checked.get()).toBe(false);
    expect(itemC.getExposes().checked.get()).toBe(true);

    itemA.getExposes().focusSelf();
    await flushReconciliation();
    const right = dispatchKey(itemA, 'ArrowRight');
    await flushReconciliation();
    expect(right.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(itemC);
    expect(root.getExposes().value.get()).toBe('c');
    const down = dispatchKey(itemC, 'ArrowDown');
    await flushReconciliation();
    expect(down.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(itemA);
    expect(root.getExposes().value.get()).toBe('a');
    const left = dispatchKey(itemA, 'ArrowLeft');
    await flushReconciliation();
    expect(left.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(itemC);
    expect(root.getExposes().value.get()).toBe('c');
    const up = dispatchKey(itemC, 'ArrowUp');
    await flushReconciliation();
    expect(up.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(itemA);
    expect(root.getExposes().value.get()).toBe('a');
    const end = dispatchKey(itemA, 'End');
    await flushReconciliation();
    expect(end.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(itemC);
    expect(root.getExposes().value.get()).toBe('c');
    const home = dispatchKey(itemC, 'Home');
    await flushReconciliation();
    expect(home.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(itemA);
    expect(root.getExposes().value.get()).toBe('a');
    expect(itemB.getExposes().checked.get()).toBe(false);
    expect(itemB.tabIndex).toBe(-1);

    setElementProps(root, { disabled: true });
    await flushReconciliation();
    expect(root.getAttribute('aria-disabled')).toBe('true');
    expect(root.getExposes().disabled.get()).toBe(true);
    for (const item of [itemA, itemB, itemC]) {
      expect(item.getAttribute('aria-disabled')).toBe('true');
      expect(item.getExposes().disabled.get()).toBe(true);
      expect(item.tabIndex).toBe(-1);
    }
    const disabledValue = root.getExposes().value.get();
    itemC.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushReconciliation();
    expect(root.getExposes().value.get()).toBe(disabledValue);
    itemC.getExposes().focusSelf();
    await flushReconciliation();
    expect(document.activeElement).not.toBe(itemC);

    setElementProps(root, { disabled: false });
    await flushReconciliation();
    expect(root.getAttribute('aria-disabled')).toBe('false');
    expect(root.getExposes().disabled.get()).toBe(false);
    expect(itemA.getExposes().disabled.get()).toBe(false);
    expect(itemB.getExposes().disabled.get()).toBe(true);
    expect(itemC.getExposes().disabled.get()).toBe(false);
    itemC.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushReconciliation();
    expect(root.getExposes().value.get()).toBe('c');
    expect(itemC.getExposes().checked.get()).toBe(true);
    expect(secondRoot.getExposes().value.get()).toBe('c');
    expect(secondC.getExposes().checked.get()).toBe(true);

    setElementProps(root, { value: 'a', a11yLabel: 'Updated delivery method' });
    await flushReconciliation();
    expect(root.getAttribute('aria-label')).toBe('Updated delivery method');
    expect(root.getExposes().value.get()).toBe('a');
    expect(itemA.getExposes().checked.get()).toBe(true);
    expect(itemC.getExposes().checked.get()).toBe(false);
    expect(secondRoot.getExposes().value.get()).toBe('c');
    expect(secondC.getExposes().checked.get()).toBe(true);

    secondC.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushReconciliation();
    expect(secondRoot.getExposes().value.get()).toBe('c');
    expect(secondC.getExposes().checked.get()).toBe(true);
    secondA.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushReconciliation();
    expect(secondRoot.getExposes().value.get()).toBe('a');
    expect(secondA.getExposes().checked.get()).toBe(true);
    expect(secondB.getExposes().checked.get()).toBe(false);
    expect(root.getExposes().value.get()).toBe('a');
    expect(itemA.getExposes().checked.get()).toBe(true);
    expect(itemC.getExposes().checked.get()).toBe(false);

    root.remove();
    secondRoot.remove();
    await flushReconciliation();
  });
});
