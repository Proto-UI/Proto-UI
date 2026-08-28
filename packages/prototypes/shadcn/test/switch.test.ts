import { describe, expect, it, vi } from 'vitest';
import { styleContains } from '../../test-utils/style';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { switchRoot, switchThumb } from '../src/switch';

AdaptToWebComponent(switchRoot as any);
AdaptToWebComponent(switchThumb as any);

describe('prototypes/shadcn: switch', () => {
  it('keeps root and thumb as named direct entries', () => {
    expect(switchRoot.name).toBe('shadcn-switch-root');
    expect(switchThumb.name).toBe('shadcn-switch-thumb');
  });

  it('runs as a compound switch and keeps thumb attached to root state', async () => {
    const root = document.createElement('shadcn-switch-root') as any;
    const thumb = document.createElement('shadcn-switch-thumb') as any;
    root.appendChild(thumb);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    expect(root.getExposes().checked.get()).toBe(false);
    expect(thumb.getExposes().isChecked()).toBe(false);

    root.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();

    expect(root.getExposes().checked.get()).toBe(true);
    expect(thumb.getExposes().isChecked()).toBe(true);
    expect(root.getAttribute('aria-checked')).toBe('true');
    expect(styleContains(root, 'data-[checked]:bg-primary')).toBe(true);
    expect(styleContains(root, 'px-0.5')).toBe(true);
    expect(styleContains(root, 'data-[checked]:pl-5')).toBe(false);
    expect(styleContains(thumb, 'size-5')).toBe(true);
    expect(styleContains(thumb, 'translate-x-0')).toBe(true);
    expect(styleContains(thumb, 'ring-offset-0')).toBe(true);
    expect(styleContains(thumb, 'data-[checked]:translate-x-[calc(100%_-_2px)]')).toBe(true);
    expect(thumb.hasAttribute('data-checked')).toBe(true);

    root.remove();
    await Promise.resolve();
  });

  it('applies focus-visible ring styles when keyboard focus reaches the root', async () => {
    const root = document.createElement('shadcn-switch-root') as any;
    const thumb = document.createElement('shadcn-switch-thumb') as any;
    root.appendChild(thumb);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    expect(styleContains(root, 'ring-3')).toBe(false);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    const matchesSpy = vi.spyOn(root, 'matches').mockReturnValue(true);
    root.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    await Promise.resolve();

    expect(root.getExposes().focusVisible.get()).toBe(true);
    expect(styleContains(root, 'data-[focus-visible]:ring-3')).toBe(true);
    expect(styleContains(root, 'data-[focus-visible]:ring-ring/50')).toBe(true);
    expect(styleContains(root, 'data-[focus-visible]:ring-offset-2')).toBe(true);
    expect(thumb.hasAttribute('data-focus-visible')).toBe(false);

    root.remove();
    await Promise.resolve();
  });

  it('disabled shadcn switch suppresses checked changes', async () => {
    const root = document.createElement('shadcn-switch-root') as any;
    const thumb = document.createElement('shadcn-switch-thumb') as any;
    setElementProps(root, { disabled: true, defaultChecked: false });
    root.appendChild(thumb);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    root.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(root.getExposes().checked.get()).toBe(false);
    expect(thumb.getExposes().isChecked()).toBe(false);
    expect(root.hasAttribute('data-disabled')).toBe(true);

    root.remove();
    await Promise.resolve();
  });
});
