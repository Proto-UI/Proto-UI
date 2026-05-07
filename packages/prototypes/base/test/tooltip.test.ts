import { describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { tooltipContent, tooltipRoot, tooltipTrigger } from '../src/tooltip';

AdaptToWebComponent(tooltipRoot as any);
AdaptToWebComponent(tooltipTrigger as any);
AdaptToWebComponent(tooltipContent as any);

describe('prototypes/base: tooltip', () => {
  it('honors defaultOpen on initial mount', async () => {
    const root = document.createElement('base-tooltip-root') as any;
    const trigger = document.createElement('base-tooltip-trigger') as any;
    const content = document.createElement('base-tooltip-content') as any;

    setElementProps(root, { defaultOpen: true });
    root.appendChild(trigger);
    root.appendChild(content);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    expect(root.getExposes().open.get()).toBe(true);
    expect(content.getExposes().open.get()).toBe(true);
    expect(content.classList.contains('hidden')).toBe(false);

    root.remove();
    await Promise.resolve();
  });

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
    await Promise.resolve();

    expect(root.getExposes().open.get()).toBe(true);
    expect(content.getExposes().open.get()).toBe(true);
    expect(content.classList.contains('hidden')).toBe(false);

    trigger.dispatchEvent(new Event('pointerleave'));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(root.getExposes().open.get()).toBe(false);
    expect(content.classList.contains('hidden')).toBe(true);

    root.remove();
    await Promise.resolve();
  });

  it('waits for the configured delay before opening on hover', async () => {
    vi.useFakeTimers();

    const root = document.createElement('base-tooltip-root') as any;
    const trigger = document.createElement('base-tooltip-trigger') as any;
    const content = document.createElement('base-tooltip-content') as any;

    try {
      setElementProps(root, { delay: 40 });
      root.appendChild(trigger);
      root.appendChild(content);
      document.body.appendChild(root);

      await Promise.resolve();
      await Promise.resolve();

      trigger.dispatchEvent(new Event('pointerenter'));
      await Promise.resolve();

      expect(root.getExposes().open.get()).toBe(false);
      expect(content.classList.contains('hidden')).toBe(true);

      vi.advanceTimersByTime(39);
      await Promise.resolve();

      expect(root.getExposes().open.get()).toBe(false);

      vi.advanceTimersByTime(1);
      await Promise.resolve();
      await Promise.resolve();

      expect(root.getExposes().open.get()).toBe(true);
      expect(content.classList.contains('hidden')).toBe(false);
    } finally {
      root.remove();
      await Promise.resolve();
      vi.useRealTimers();
    }
  });

  it('cancels a pending delayed open when the pointer leaves', async () => {
    vi.useFakeTimers();

    const root = document.createElement('base-tooltip-root') as any;
    const trigger = document.createElement('base-tooltip-trigger') as any;
    const content = document.createElement('base-tooltip-content') as any;

    try {
      setElementProps(root, { delay: 60 });
      root.appendChild(trigger);
      root.appendChild(content);
      document.body.appendChild(root);

      await Promise.resolve();
      await Promise.resolve();

      trigger.dispatchEvent(new Event('pointerenter'));
      await Promise.resolve();

      vi.advanceTimersByTime(30);
      await Promise.resolve();

      trigger.dispatchEvent(new Event('pointerleave'));
      await Promise.resolve();

      vi.advanceTimersByTime(100);
      await Promise.resolve();
      await Promise.resolve();

      expect(root.getExposes().open.get()).toBe(false);
      expect(content.classList.contains('hidden')).toBe(true);
    } finally {
      root.remove();
      await Promise.resolve();
      vi.useRealTimers();
    }
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
    await Promise.resolve();

    expect(root.getExposes().open.get()).toBe(true);

    trigger.dispatchEvent(new FocusEvent('blur'));
    await Promise.resolve();
    await Promise.resolve();

    expect(root.getExposes().open.get()).toBe(false);

    root.remove();
    await Promise.resolve();
  });

  it('disabling an open tooltip forces it closed', async () => {
    const root = document.createElement('base-tooltip-root') as any;
    const trigger = document.createElement('base-tooltip-trigger') as any;
    const content = document.createElement('base-tooltip-content') as any;

    root.appendChild(trigger);
    root.appendChild(content);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    trigger.dispatchEvent(new Event('pointerenter'));
    await Promise.resolve();
    await Promise.resolve();

    expect(root.getExposes().open.get()).toBe(true);

    setElementProps(root, { disabled: true });
    await Promise.resolve();
    await Promise.resolve();

    expect(root.getExposes().open.get()).toBe(false);
    expect(content.classList.contains('hidden')).toBe(true);

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
