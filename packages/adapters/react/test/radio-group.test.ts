import { describe, expect, it } from 'vitest';
import {
  radioGroupIndicator,
  radioGroupItem,
  radioGroupRoot,
} from '../../../prototypes/base/src/radio-group';

import { createMountedReactAdapter, createMountedReactAdapterInto } from './utils/fake-react';

function appendHost(parent: HTMLElement): HTMLElement {
  const host = document.createElement('span');
  parent.appendChild(host);
  return host;
}

async function settle(): Promise<void> {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

describe('adapter-react: base radio group compound protocol', () => {
  it('projects selection, disabled state, roving focus, control semantics, and group isolation', async () => {
    const root = createMountedReactAdapter(radioGroupRoot, {
      defaultValue: 'a',
      a11yLabel: 'React radio group',
    });
    const rootEl = root.root as HTMLElement;
    const itemA = createMountedReactAdapterInto(radioGroupItem, appendHost(rootEl), {
      value: 'a',
    });
    const itemB = createMountedReactAdapterInto(radioGroupItem, appendHost(rootEl), {
      value: 'b',
      disabled: true,
    });
    const itemC = createMountedReactAdapterInto(radioGroupItem, appendHost(rootEl), {
      value: 'c',
    });
    const indicatorA = createMountedReactAdapterInto(
      radioGroupIndicator,
      appendHost(itemA.root!),
    );
    const indicatorB = createMountedReactAdapterInto(
      radioGroupIndicator,
      appendHost(itemB.root!),
    );
    const indicatorC = createMountedReactAdapterInto(
      radioGroupIndicator,
      appendHost(itemC.root!),
    );

    const secondRoot = createMountedReactAdapter(radioGroupRoot, {
      defaultValue: 'a',
      a11yLabel: 'Second React radio group',
    });
    const secondRootEl = secondRoot.root as HTMLElement;
    const secondItemA = createMountedReactAdapterInto(radioGroupItem, appendHost(secondRootEl), {
      value: 'a',
    });
    const secondItemB = createMountedReactAdapterInto(radioGroupItem, appendHost(secondRootEl), {
      value: 'b',
      disabled: true,
    });
    const secondItemC = createMountedReactAdapterInto(radioGroupItem, appendHost(secondRootEl), {
      value: 'c',
    });

    try {
      expect(root.root?.getAttribute('role')).toBe('radiogroup');
      expect(root.root?.getAttribute('aria-label')).toBe('React radio group');
      expect(root.root?.getAttribute('aria-disabled')).toBe('false');
      expect(root.ref.current?.getExposes().value.get()).toBe('a');
      expect(root.ref.current?.getExposes().disabled.get()).toBe(false);

      expect(itemA.root?.getAttribute('role')).toBe('radio');
      expect(itemA.root?.getAttribute('aria-checked')).toBe('true');
      expect(itemA.root?.getAttribute('aria-disabled')).toBe('false');
      expect(itemA.root?.tabIndex).toBe(0);
      expect(itemA.ref.current?.getExposes().checked.get()).toBe(true);
      expect(itemA.ref.current?.getExposes().disabled.get()).toBe(false);

      expect(itemB.root?.getAttribute('role')).toBe('radio');
      expect(itemB.root?.getAttribute('aria-checked')).toBe('false');
      expect(itemB.root?.getAttribute('aria-disabled')).toBe('true');
      expect(itemB.root?.tabIndex).toBe(-1);
      expect(itemB.ref.current?.getExposes().checked.get()).toBe(false);
      expect(itemB.ref.current?.getExposes().disabled.get()).toBe(true);

      expect(itemC.root?.getAttribute('role')).toBe('radio');
      expect(itemC.root?.getAttribute('aria-checked')).toBe('false');
      expect(itemC.root?.getAttribute('aria-disabled')).toBe('false');
      expect(itemC.root?.tabIndex).toBe(-1);
      expect(itemC.ref.current?.getExposes().checked.get()).toBe(false);
      expect(itemC.ref.current?.getExposes().disabled.get()).toBe(false);

      expect(indicatorA.ref.current?.getExposes().checked.get()).toBe(true);
      expect(indicatorA.ref.current?.getExposes().disabled.get()).toBe(false);
      expect(indicatorB.ref.current?.getExposes().checked.get()).toBe(false);
      expect(indicatorB.ref.current?.getExposes().disabled.get()).toBe(true);
      expect(indicatorC.ref.current?.getExposes().checked.get()).toBe(false);
      expect(indicatorC.ref.current?.getExposes().disabled.get()).toBe(false);

      for (const indicator of [indicatorA, indicatorB, indicatorC]) {
        expect(indicator.root?.getAttribute('role')).toBeNull();
        expect(indicator.root?.hasAttribute('tabindex')).toBe(false);
        expect(indicator.root?.getAttribute('data-pui-a11y-actions')).toBeNull();
        expect(indicator.root?.getAttribute('aria-checked')).toBeNull();
        expect(indicator.root?.getAttribute('aria-disabled')).toBeNull();
        expect(indicator.root?.querySelector('[role="radio"]')).toBeNull();
      }

      itemC.ref.current?.getExposes().focusSelf();
      await settle();
      expect(document.activeElement).toBe(itemC.root);
      expect(root.ref.current?.getExposes().value.get()).toBe('a');

      const space = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
      window.dispatchEvent(space);
      await settle();
      expect(space.defaultPrevented).toBe(true);
      window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }));
      await settle();
      expect(root.ref.current?.getExposes().value.get()).toBe('c');
      expect(itemC.ref.current?.getExposes().checked.get()).toBe(true);

      itemA.ref.current?.getExposes().focusSelf();
      await settle();
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));
      await settle();
      expect(document.activeElement).toBe(itemA.root);
      expect(root.ref.current?.getExposes().value.get()).toBe('c');
      expect(itemC.ref.current?.getExposes().checked.get()).toBe(true);

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true }));
      await settle();
      expect(document.activeElement).toBe(itemC.root);
      expect(root.ref.current?.getExposes().value.get()).toBe('c');

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }));
      await settle();
      expect(document.activeElement).toBe(itemA.root);
      expect(root.ref.current?.getExposes().value.get()).toBe('a');

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true }));
      await settle();
      expect(document.activeElement).toBe(itemC.root);
      expect(root.ref.current?.getExposes().value.get()).toBe('c');

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true }));
      await settle();
      expect(document.activeElement).toBe(itemA.root);
      expect(root.ref.current?.getExposes().value.get()).toBe('a');

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', cancelable: true }));
      await settle();
      expect(document.activeElement).toBe(itemC.root);
      expect(root.ref.current?.getExposes().value.get()).toBe('c');

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', cancelable: true }));
      await settle();
      expect(document.activeElement).toBe(itemA.root);
      expect(root.ref.current?.getExposes().value.get()).toBe('a');
      expect([itemA.root?.tabIndex, itemB.root?.tabIndex, itemC.root?.tabIndex]).toEqual([
        0,
        -1,
        -1,
      ]);

      root.update({ value: 'c', a11yLabel: 'React radio group', disabled: false });
      await settle();
      expect(root.ref.current?.getExposes().value.get()).toBe('c');
      expect(root.root?.getAttribute('aria-disabled')).toBe('false');
      expect(itemA.ref.current?.getExposes().checked.get()).toBe(false);
      expect(itemB.ref.current?.getExposes().checked.get()).toBe(false);
      expect(itemC.ref.current?.getExposes().checked.get()).toBe(true);
      expect(itemA.root?.tabIndex).toBe(0);
      expect(itemB.root?.tabIndex).toBe(-1);
      expect(itemC.root?.tabIndex).toBe(-1);
      expect(document.activeElement).toBe(itemA.root);

      root.update({ value: 'c', a11yLabel: 'React radio group', disabled: true });
      await settle();
      expect(root.ref.current?.getExposes().disabled.get()).toBe(true);
      expect(root.root?.getAttribute('aria-disabled')).toBe('true');
      for (const item of [itemA, itemB, itemC]) {
        expect(item.ref.current?.getExposes().disabled.get()).toBe(true);
        expect(item.root?.getAttribute('aria-disabled')).toBe('true');
        expect(item.root?.tabIndex).toBe(-1);
      }
      expect(indicatorA.ref.current?.getExposes().disabled.get()).toBe(true);
      expect(indicatorB.ref.current?.getExposes().disabled.get()).toBe(true);
      expect(indicatorC.ref.current?.getExposes().disabled.get()).toBe(true);

      itemA.root?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();
      expect(root.ref.current?.getExposes().value.get()).toBe('c');
      itemA.root?.blur();
      itemA.ref.current?.getExposes().focusSelf();
      root.ref.current?.getExposes().focusNext();
      await settle();
      expect(document.activeElement).not.toBe(itemA.root);
      expect(root.ref.current?.getExposes().value.get()).toBe('c');

      expect(secondRoot.root?.getAttribute('role')).toBe('radiogroup');
      expect(secondRoot.root?.getAttribute('aria-label')).toBe('Second React radio group');
      expect(secondRoot.ref.current?.getExposes().value.get()).toBe('a');
      expect(secondItemA.ref.current?.getExposes().checked.get()).toBe(true);
      expect(secondItemB.ref.current?.getExposes().disabled.get()).toBe(true);
      expect(secondItemC.ref.current?.getExposes().checked.get()).toBe(false);

      secondItemC.root?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();
      expect(secondRoot.ref.current?.getExposes().value.get()).toBe('c');
      expect(secondItemA.ref.current?.getExposes().checked.get()).toBe(false);
      expect(secondItemC.ref.current?.getExposes().checked.get()).toBe(true);
      expect(root.ref.current?.getExposes().value.get()).toBe('c');
      expect(itemC.ref.current?.getExposes().checked.get()).toBe(true);
    } finally {
      secondItemC.unmount();
      secondItemB.unmount();
      secondItemA.unmount();
      secondRoot.unmount();
      indicatorC.unmount();
      indicatorB.unmount();
      indicatorA.unmount();
      itemC.unmount();
      itemB.unmount();
      itemA.unmount();
      root.unmount();
    }
  });
});
