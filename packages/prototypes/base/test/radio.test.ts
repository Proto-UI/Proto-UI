import { describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { radioGroupRoot, radioItem } from '../src/radio';

AdaptToWebComponent(radioGroupRoot as any, { registerAs: 'wc-base-radio-group-root' });
AdaptToWebComponent(radioItem as any, { registerAs: 'wc-base-radio-item' });

describe('prototypes/base: radio', () => {
  it('radio-group-root initializes with default value', async () => {
    const root = document.createElement('wc-base-radio-group-root') as any;
    setElementProps(root, { defaultValue: 'a' });
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    const exposes = root.getExposes() as any;
    expect(exposes.value.get()).toBe('a');

    root.remove();
    await Promise.resolve();
  });

  it('radio-item reads checked from group via context', async () => {
    const root = document.createElement('wc-base-radio-group-root') as any;
    setElementProps(root, { defaultValue: 'a' });
    const item1 = document.createElement('wc-base-radio-item') as any;
    const item2 = document.createElement('wc-base-radio-item') as any;
    setElementProps(item1, { value: 'a' });
    setElementProps(item2, { value: 'b' });
    root.appendChild(item1);
    root.appendChild(item2);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    const item1Exposes = item1.getExposes() as any;
    const item2Exposes = item2.getExposes() as any;
    expect(item1Exposes.checked.get()).toBe(true);
    expect(item2Exposes.checked.get()).toBe(false);

    root.remove();
    await Promise.resolve();
  });

  it('click on radio-item selects it and unselects others', async () => {
    const root = document.createElement('wc-base-radio-group-root') as any;
    setElementProps(root, { defaultValue: 'a' });
    const itemA = document.createElement('wc-base-radio-item') as any;
    const itemB = document.createElement('wc-base-radio-item') as any;
    setElementProps(itemA, { value: 'a' });
    setElementProps(itemB, { value: 'b' });
    root.appendChild(itemA);
    root.appendChild(itemB);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    itemB.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();

    const itemAExposes = itemA.getExposes() as any;
    const itemBExposes = itemB.getExposes() as any;
    expect(itemAExposes.checked.get()).toBe(false);
    expect(itemBExposes.checked.get()).toBe(true);

    const rootExposes = root.getExposes() as any;
    expect(rootExposes.value.get()).toBe('b');

    root.remove();
    await Promise.resolve();
  });

  it('valueChange event is emitted on selection change', async () => {
    const root = document.createElement('wc-base-radio-group-root') as any;
    setElementProps(root, { defaultValue: 'a' });
    const itemA = document.createElement('wc-base-radio-item') as any;
    const itemB = document.createElement('wc-base-radio-item') as any;
    setElementProps(itemA, { value: 'a' });
    setElementProps(itemB, { value: 'b' });
    root.appendChild(itemA);
    root.appendChild(itemB);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    let emittedValue = '';
    root.addEventListener('valueChange', (e: any) => {
      emittedValue = e.detail?.value ?? '';
    });

    itemB.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();

    expect(emittedValue).toBe('b');

    root.remove();
    await Promise.resolve();
  });

  it('radio-item resyncs checked state when its value prop changes', async () => {
    const root = document.createElement('wc-base-radio-group-root') as any;
    setElementProps(root, { defaultValue: 'b' });
    const item = document.createElement('wc-base-radio-item') as any;
    setElementProps(item, { value: 'a' });
    root.appendChild(item);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    const itemExposes = item.getExposes() as any;
    expect(itemExposes.checked.get()).toBe(false);

    setElementProps(item, { value: 'b' });
    await Promise.resolve();

    expect(itemExposes.checked.get()).toBe(true);

    root.remove();
    await Promise.resolve();
  });

  it('disabled radio-item does not change the selected value', async () => {
    const root = document.createElement('wc-base-radio-group-root') as any;
    setElementProps(root, { defaultValue: 'a' });
    const itemA = document.createElement('wc-base-radio-item') as any;
    const itemB = document.createElement('wc-base-radio-item') as any;
    setElementProps(itemA, { value: 'a' });
    setElementProps(itemB, { value: 'b', disabled: true });
    root.appendChild(itemA);
    root.appendChild(itemB);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    itemB.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();

    const rootExposes = root.getExposes() as any;
    const itemAExposes = itemA.getExposes() as any;
    const itemBExposes = itemB.getExposes() as any;
    expect(rootExposes.value.get()).toBe('a');
    expect(itemAExposes.checked.get()).toBe(true);
    expect(itemBExposes.checked.get()).toBe(false);

    root.remove();
    await Promise.resolve();
  });

  it('disabled radio-group-root prevents item selection', async () => {
    const root = document.createElement('wc-base-radio-group-root') as any;
    setElementProps(root, { defaultValue: 'a', disabled: true });
    const itemA = document.createElement('wc-base-radio-item') as any;
    const itemB = document.createElement('wc-base-radio-item') as any;
    setElementProps(itemA, { value: 'a' });
    setElementProps(itemB, { value: 'b' });
    root.appendChild(itemA);
    root.appendChild(itemB);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    itemB.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();

    const rootExposes = root.getExposes() as any;
    const itemAExposes = itemA.getExposes() as any;
    const itemBExposes = itemB.getExposes() as any;
    expect(rootExposes.value.get()).toBe('a');
    expect(itemAExposes.checked.get()).toBe(true);
    expect(itemBExposes.checked.get()).toBe(false);

    root.remove();
    await Promise.resolve();
  });

  it('controlled radio-group-root emits valueChange without changing value directly', async () => {
    const root = document.createElement('wc-base-radio-group-root') as any;
    setElementProps(root, { value: 'a' });
    const itemA = document.createElement('wc-base-radio-item') as any;
    const itemB = document.createElement('wc-base-radio-item') as any;
    setElementProps(itemA, { value: 'a' });
    setElementProps(itemB, { value: 'b' });
    root.appendChild(itemA);
    root.appendChild(itemB);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    let emittedValue = '';
    root.addEventListener('valueChange', (e: any) => {
      emittedValue = e.detail?.value ?? '';
    });

    itemB.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();

    const rootExposes = root.getExposes() as any;
    const itemAExposes = itemA.getExposes() as any;
    const itemBExposes = itemB.getExposes() as any;
    expect(emittedValue).toBe('b');
    expect(rootExposes.value.get()).toBe('a');
    expect(itemAExposes.checked.get()).toBe(true);
    expect(itemBExposes.checked.get()).toBe(false);

    setElementProps(root, { value: 'b' });
    await Promise.resolve();

    expect(rootExposes.value.get()).toBe('b');
    expect(itemAExposes.checked.get()).toBe(false);
    expect(itemBExposes.checked.get()).toBe(true);

    root.remove();
    await Promise.resolve();
  });
});
