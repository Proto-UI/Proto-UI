import { describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { checkboxRoot, checkboxIndicator } from '../src/checkbox';

AdaptToWebComponent(checkboxRoot as any, { registerAs: 'wc-base-checkbox-root' });
AdaptToWebComponent(checkboxIndicator as any, { registerAs: 'wc-base-checkbox-indicator' });

describe('prototypes/base: checkbox', () => {
  it('checkbox-root reuses toggle semantics for checked state and checkedChange', async () => {
    const root = document.createElement('wc-base-checkbox-root') as any;
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    const exposes = root.getExposes() as any;
    expect(exposes.checked.get()).toBe(false);

    root.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(exposes.checked.get()).toBe(true);
    root.remove();
    await Promise.resolve();
  });

  it('checkbox-root supports indeterminate state', async () => {
    const root = document.createElement('wc-base-checkbox-root') as any;
    setElementProps(root, { defaultIndeterminate: true });
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    const exposes = root.getExposes() as any;
    expect(exposes.indeterminate.get()).toBe(true);
    expect(exposes.checked.get()).toBe(false);

    root.remove();
    await Promise.resolve();
  });

  it('checkbox-root clears uncontrolled indeterminate on press.commit', async () => {
    const root = document.createElement('wc-base-checkbox-root') as any;
    setElementProps(root, { defaultIndeterminate: true });
    const events: Array<{ indeterminate: boolean }> = [];
    root.addEventListener('indeterminateChange', (event: Event) => {
      events.push((event as CustomEvent).detail);
    });
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    const exposes = root.getExposes() as any;
    expect(exposes.indeterminate.get()).toBe(true);

    root.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(exposes.indeterminate.get()).toBe(false);
    expect(events).toEqual([{ indeterminate: false }]);
    root.remove();
    await Promise.resolve();
  });

  it('checkbox-root keeps controlled indeterminate stable and emits indeterminateChange', async () => {
    const root = document.createElement('wc-base-checkbox-root') as any;
    setElementProps(root, { indeterminate: true });
    const events: Array<{ indeterminate: boolean }> = [];
    root.addEventListener('indeterminateChange', (event: Event) => {
      events.push((event as CustomEvent).detail);
    });
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    const exposes = root.getExposes() as any;
    expect(exposes.indeterminate.get()).toBe(true);

    root.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(exposes.indeterminate.get()).toBe(true);
    expect(events).toEqual([{ indeterminate: false }]);

    setElementProps(root, { indeterminate: false });
    await Promise.resolve();

    expect(exposes.indeterminate.get()).toBe(false);
    root.remove();
    await Promise.resolve();
  });

  it('checkbox-root reuses toggle checked semantics when clearing indeterminate', async () => {
    const root = document.createElement('wc-base-checkbox-root') as any;
    setElementProps(root, { defaultChecked: true, defaultIndeterminate: true });
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    const exposes = root.getExposes() as any;
    expect(exposes.checked.get()).toBe(true);
    expect(exposes.indeterminate.get()).toBe(true);

    root.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(exposes.checked.get()).toBe(false);
    expect(exposes.indeterminate.get()).toBe(false);
    root.remove();
    await Promise.resolve();
  });

  it('checkbox-indicator reads root checked and indeterminate through anatomy', async () => {
    const root = document.createElement('wc-base-checkbox-root') as any;
    const indicator = document.createElement('wc-base-checkbox-indicator') as any;
    setElementProps(root, { defaultIndeterminate: true });
    root.appendChild(indicator);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    const indicatorExposes = indicator.getExposes();

    expect(indicatorExposes.isChecked()).toBe(false);
    expect(indicatorExposes.isIndeterminate()).toBe(true);
    expect(indicatorExposes.checked.get()).toBe(false);
    expect(indicatorExposes.indeterminate.get()).toBe(true);

    root.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(indicatorExposes.isChecked()).toBe(true);
    expect(indicatorExposes.isIndeterminate()).toBe(false);
    expect(indicatorExposes.checked.get()).toBe(true);
    expect(indicatorExposes.indeterminate.get()).toBe(false);

    root.remove();
    await Promise.resolve();
  });

  it('checkbox-indicator syncs controlled indeterminate prop changes from root', async () => {
    const root = document.createElement('wc-base-checkbox-root') as any;
    const indicator = document.createElement('wc-base-checkbox-indicator') as any;
    setElementProps(root, { indeterminate: true });
    root.appendChild(indicator);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    const indicatorExposes = indicator.getExposes();
    expect(indicatorExposes.indeterminate.get()).toBe(true);

    setElementProps(root, { indeterminate: false });
    await Promise.resolve();

    expect(indicatorExposes.indeterminate.get()).toBe(false);

    root.remove();
    await Promise.resolve();
  });

  it('disabled checkbox-root suppresses checked changes', async () => {
    const root = document.createElement('wc-base-checkbox-root') as any;
    setElementProps(root, { disabled: true });
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    const exposes = root.getExposes() as any;
    root.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(exposes.checked.get()).toBe(false);
    root.remove();
    await Promise.resolve();
  });

  it('disabled checkbox-root suppresses indeterminate clearing', async () => {
    const root = document.createElement('wc-base-checkbox-root') as any;
    setElementProps(root, { disabled: true, defaultIndeterminate: true });
    const events: Array<{ indeterminate: boolean }> = [];
    root.addEventListener('indeterminateChange', (event: Event) => {
      events.push((event as CustomEvent).detail);
    });
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    const exposes = root.getExposes() as any;
    root.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(exposes.indeterminate.get()).toBe(true);
    expect(events).toEqual([]);
    root.remove();
    await Promise.resolve();
  });
});
