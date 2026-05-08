import { describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  tooltipArrow,
  tooltipContent,
  tooltipGroup,
  tooltipOverlay,
  tooltipRoot,
  tooltipTrigger,
} from '../src/tooltip';

AdaptToWebComponent(tooltipGroup as any);
AdaptToWebComponent(tooltipRoot as any);
AdaptToWebComponent(tooltipTrigger as any);
AdaptToWebComponent(tooltipOverlay as any);
AdaptToWebComponent(tooltipContent as any);
AdaptToWebComponent(tooltipArrow as any);

describe('prototypes/base: tooltip', () => {
  it('honors defaultOpen on initial mount', async () => {
    const root = document.createElement('base-tooltip-root') as any;
    const trigger = document.createElement('base-tooltip-trigger') as any;
    const overlay = document.createElement('base-tooltip-overlay') as any;
    const content = document.createElement('base-tooltip-content') as any;

    setElementProps(root, { defaultOpen: true });
    overlay.appendChild(content);
    root.appendChild(trigger);
    root.appendChild(overlay);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    expect(root.getExposes().open.get()).toBe(true);
    expect(overlay.getExposes().open.get()).toBe(true);
    expect(overlay.classList.contains('hidden')).toBe(false);

    root.remove();
    await Promise.resolve();
  });

  it('opens on trigger hover and closes on trigger leave', async () => {
    const root = document.createElement('base-tooltip-root') as any;
    const trigger = document.createElement('base-tooltip-trigger') as any;
    const overlay = document.createElement('base-tooltip-overlay') as any;
    const content = document.createElement('base-tooltip-content') as any;

    overlay.appendChild(content);
    root.appendChild(trigger);
    root.appendChild(overlay);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    expect(root.getExposes().open.get()).toBe(false);
    expect(overlay.classList.contains('hidden')).toBe(true);

    trigger.dispatchEvent(new Event('pointerenter'));
    await Promise.resolve();
    await Promise.resolve();

    expect(root.getExposes().open.get()).toBe(true);
    expect(overlay.getExposes().open.get()).toBe(true);
    expect(overlay.classList.contains('hidden')).toBe(false);

    trigger.dispatchEvent(new Event('pointerleave'));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(root.getExposes().open.get()).toBe(false);
    expect(overlay.classList.contains('hidden')).toBe(true);

    root.remove();
    await Promise.resolve();
  });

  it('waits for the configured delay before opening on hover', async () => {
    vi.useFakeTimers();

    const root = document.createElement('base-tooltip-root') as any;
    const trigger = document.createElement('base-tooltip-trigger') as any;
    const overlay = document.createElement('base-tooltip-overlay') as any;

    try {
      setElementProps(root, { delay: 40 });
      root.appendChild(trigger);
      root.appendChild(overlay);
      document.body.appendChild(root);

      await Promise.resolve();
      await Promise.resolve();

      trigger.dispatchEvent(new Event('pointerenter'));
      await Promise.resolve();

      expect(root.getExposes().open.get()).toBe(false);
      expect(overlay.classList.contains('hidden')).toBe(true);

      vi.advanceTimersByTime(39);
      await Promise.resolve();

      expect(root.getExposes().open.get()).toBe(false);

      vi.advanceTimersByTime(1);
      await Promise.resolve();
      await Promise.resolve();

      expect(root.getExposes().open.get()).toBe(true);
      expect(overlay.classList.contains('hidden')).toBe(false);
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
    const overlay = document.createElement('base-tooltip-overlay') as any;

    try {
      setElementProps(root, { delay: 60 });
      root.appendChild(trigger);
      root.appendChild(overlay);
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
      expect(overlay.classList.contains('hidden')).toBe(true);
    } finally {
      root.remove();
      await Promise.resolve();
      vi.useRealTimers();
    }
  });

  it('opens on trigger focus and closes on blur', async () => {
    const root = document.createElement('base-tooltip-root') as any;
    const trigger = document.createElement('base-tooltip-trigger') as any;
    const overlay = document.createElement('base-tooltip-overlay') as any;

    root.appendChild(trigger);
    root.appendChild(overlay);
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
    const overlay = document.createElement('base-tooltip-overlay') as any;

    root.appendChild(trigger);
    root.appendChild(overlay);
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
    expect(overlay.classList.contains('hidden')).toBe(true);

    root.remove();
    await Promise.resolve();
  });

  it('controlled root ignores hover-driven open changes', async () => {
    const root = document.createElement('base-tooltip-root') as any;
    const trigger = document.createElement('base-tooltip-trigger') as any;
    const overlay = document.createElement('base-tooltip-overlay') as any;

    setElementProps(root, { open: false });
    root.appendChild(trigger);
    root.appendChild(overlay);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    trigger.dispatchEvent(new Event('pointerenter'));
    await Promise.resolve();

    expect(root.getExposes().open.get()).toBe(false);
    expect(overlay.classList.contains('hidden')).toBe(true);

    setElementProps(root, { open: true });
    await Promise.resolve();
    await Promise.resolve();

    expect(root.getExposes().open.get()).toBe(true);
    expect(overlay.classList.contains('hidden')).toBe(false);

    root.remove();
    await Promise.resolve();
  });

  it('disabled root prevents open', async () => {
    const root = document.createElement('base-tooltip-root') as any;
    const trigger = document.createElement('base-tooltip-trigger') as any;
    const overlay = document.createElement('base-tooltip-overlay') as any;

    setElementProps(root, { disabled: true });
    root.appendChild(trigger);
    root.appendChild(overlay);
    document.body.appendChild(root);

    await Promise.resolve();
    await Promise.resolve();

    trigger.dispatchEvent(new Event('pointerenter'));
    await Promise.resolve();

    expect(root.getExposes().open.get()).toBe(false);
    expect(overlay.classList.contains('hidden')).toBe(true);

    root.remove();
    await Promise.resolve();
  });

  it('group skip-delay: second tooltip opens immediately when first is already open', async () => {
    vi.useFakeTimers();

    const group = document.createElement('base-tooltip-group') as any;
    setElementProps(group, { skipDelayDuration: 0 });

    const root1 = document.createElement('base-tooltip-root') as any;
    const trigger1 = document.createElement('base-tooltip-trigger') as any;
    const overlay1 = document.createElement('base-tooltip-overlay') as any;
    setElementProps(root1, { delay: 200 });
    root1.appendChild(trigger1);
    root1.appendChild(overlay1);

    const root2 = document.createElement('base-tooltip-root') as any;
    const trigger2 = document.createElement('base-tooltip-trigger') as any;
    const overlay2 = document.createElement('base-tooltip-overlay') as any;
    setElementProps(root2, { delay: 200 });
    root2.appendChild(trigger2);
    root2.appendChild(overlay2);

    group.appendChild(root1);
    group.appendChild(root2);
    document.body.appendChild(group);

    try {
      await Promise.resolve();
      await Promise.resolve();

      // Open first tooltip (must wait for delay).
      trigger1.dispatchEvent(new Event('pointerenter'));
      await Promise.resolve();
      expect(root1.getExposes().open.get()).toBe(false);

      vi.advanceTimersByTime(200);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(root1.getExposes().open.get()).toBe(true);

      // Hover second trigger while first tooltip is still open.
      // Group has openCount > 0, so skip-delay should activate.
      trigger2.dispatchEvent(new Event('pointerenter'));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // Second tooltip should open immediately (skipDelayDuration=0).
      expect(root2.getExposes().open.get()).toBe(true);

      // Clean up: leave both triggers.
      trigger1.dispatchEvent(new Event('pointerleave'));
      trigger2.dispatchEvent(new Event('pointerleave'));
      await Promise.resolve();
      await Promise.resolve();
    } finally {
      group.remove();
      await Promise.resolve();
      vi.useRealTimers();
    }
  });
});
