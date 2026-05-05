import { describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { checkboxRoot, checkboxIndicator } from '../src/checkbox';

AdaptToWebComponent(checkboxRoot as any);
AdaptToWebComponent(checkboxIndicator as any);

describe('prototypes/base: checkbox', () => {
  it('checkbox-root reuses toggle semantics for checked state and checkedChange', async () => {
    const root = document.createElement('base-checkbox-root') as any;
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
    const root = document.createElement('base-checkbox-root') as any;
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

  it('checkbox-root clears indeterminate on press.commit', async () => {
    const root = document.createElement('base-checkbox-root') as any;
    setElementProps(root, { defaultIndeterminate: true });
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    const exposes = root.getExposes() as any;
    expect(exposes.indeterminate.get()).toBe(true);

    root.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(exposes.indeterminate.get()).toBe(false);
    root.remove();
    await Promise.resolve();
  });

  it('checkbox-indicator reads root checked and indeterminate through anatomy', async () => {
    const root = document.createElement('base-checkbox-root') as any;
    const indicator = document.createElement('base-checkbox-indicator') as any;
    setElementProps(root, { defaultIndeterminate: true });
    root.appendChild(indicator);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    const indicatorExposes = indicator.getExposes();

    expect(indicatorExposes.isChecked()).toBe(false);
    expect(indicatorExposes.isIndeterminate()).toBe(true);

    root.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(indicatorExposes.isChecked()).toBe(true);
    expect(indicatorExposes.isIndeterminate()).toBe(false);

    root.remove();
    await Promise.resolve();
  });

  it('disabled checkbox-root suppresses checked changes', async () => {
    const root = document.createElement('base-checkbox-root') as any;
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
});
