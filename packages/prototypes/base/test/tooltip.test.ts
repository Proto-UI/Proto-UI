import { describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { tooltipContent, tooltipRoot, tooltipTrigger } from '../src/tooltip';

AdaptToWebComponent(tooltipRoot as any);
AdaptToWebComponent(tooltipTrigger as any);
AdaptToWebComponent(tooltipContent as any);

describe('prototypes/base: tooltip', () => {
  it('opens on trigger hover and closes on trigger leave', async () => {
    const root = document.createElement('base-tooltip-root') as any;
    const trigger = document.createElement('base-tooltip-trigger') as any;
    const content = document.createElement('base-tooltip-content') as any;

    root.appendChild(trigger);
    root.appendChild(content);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    expect(root.getExposes().open.get()).toBe(false);
    expect(content.classList.contains('hidden')).toBe(true);

    trigger.dispatchEvent(new Event('pointerenter'));
    await Promise.resolve();

    expect(root.getExposes().open.get()).toBe(true);
    expect(content.getExposes().open.get()).toBe(true);
    expect(content.classList.contains('hidden')).toBe(false);

    trigger.dispatchEvent(new Event('pointerleave'));
    await Promise.resolve();

    expect(root.getExposes().open.get()).toBe(false);
    expect(content.classList.contains('hidden')).toBe(true);

    root.remove();
    await Promise.resolve();
  });

  it('opens on trigger focus and closes on blur', async () => {
    const root = document.createElement('base-tooltip-root') as any;
    const trigger = document.createElement('base-tooltip-trigger') as any;
    const content = document.createElement('base-tooltip-content') as any;

    root.appendChild(trigger);
    root.appendChild(content);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    trigger.dispatchEvent(new FocusEvent('focus'));
    await Promise.resolve();

    expect(root.getExposes().open.get()).toBe(true);

    trigger.dispatchEvent(new FocusEvent('blur'));
    await Promise.resolve();

    expect(root.getExposes().open.get()).toBe(false);

    root.remove();
    await Promise.resolve();
  });

  it('controlled root ignores hover-driven open changes', async () => {
    const root = document.createElement('base-tooltip-root') as any;
    const trigger = document.createElement('base-tooltip-trigger') as any;
    const content = document.createElement('base-tooltip-content') as any;

    setElementProps(root, { open: false });
    root.appendChild(trigger);
    root.appendChild(content);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    trigger.dispatchEvent(new Event('pointerenter'));
    await Promise.resolve();

    expect(root.getExposes().open.get()).toBe(false);
    expect(content.classList.contains('hidden')).toBe(true);

    setElementProps(root, { open: true });
    await Promise.resolve();

    expect(root.getExposes().open.get()).toBe(true);
    expect(content.classList.contains('hidden')).toBe(false);

    root.remove();
    await Promise.resolve();
  });

  it('disabled root prevents open', async () => {
    const root = document.createElement('base-tooltip-root') as any;
    const trigger = document.createElement('base-tooltip-trigger') as any;
    const content = document.createElement('base-tooltip-content') as any;

    setElementProps(root, { disabled: true });
    root.appendChild(trigger);
    root.appendChild(content);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    trigger.dispatchEvent(new Event('pointerenter'));
    await Promise.resolve();

    expect(root.getExposes().open.get()).toBe(false);
    expect(content.classList.contains('hidden')).toBe(true);

    root.remove();
    await Promise.resolve();
  });
});
