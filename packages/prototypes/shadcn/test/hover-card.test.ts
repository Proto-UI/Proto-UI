import { afterEach, describe, expect, it, vi } from 'vitest';
import { styleContains } from '../../test-utils/style';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { hoverCardContent, hoverCardRoot, hoverCardTrigger } from '../src/hover-card';

AdaptToWebComponent(hoverCardRoot as any);
AdaptToWebComponent(hoverCardTrigger as any);
AdaptToWebComponent(hoverCardContent as any);

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(async () => {
  document.body.replaceChildren();
  await flush();
  vi.useRealTimers();
});

describe('prototypes/shadcn: hover-card', () => {
  it('keeps every Hover Card anatomy part as a named direct entry', () => {
    expect(hoverCardRoot.name).toBe('shadcn-hover-card-root');
    expect(hoverCardTrigger.name).toBe('shadcn-hover-card-trigger');
    expect(hoverCardContent.name).toBe('shadcn-hover-card-content');
  });

  it('matches the shadcn composition, content styling, API defaults, and transition behavior', async () => {
    vi.useFakeTimers();
    const root = document.createElement('shadcn-hover-card-root') as any;
    const trigger = document.createElement('shadcn-hover-card-trigger') as any;
    const content = document.createElement('shadcn-hover-card-content') as any;
    setElementProps(root, { openDelay: 0, closeDelay: 0 });
    setElementProps(content, { side: 'right', align: 'start', avoidCollisions: false });
    root.append(trigger, content);
    document.body.appendChild(root);
    await flush();

    expect(styleContains(trigger, 'underline-offset-4')).toBe(true);
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);

    trigger.dispatchEvent(new Event('pointerenter'));
    await vi.advanceTimersByTimeAsync(0);
    await flush();

    expect(root.getExposes().open.get()).toBe(true);
    expect(content.getExposes().transitionState.get()).toBe('entering');
    expect(styleContains(content, 'w-64')).toBe(true);
    expect(styleContains(content, 'rounded-md')).toBe(true);
    expect(styleContains(content, 'border-border')).toBe(true);
    expect(styleContains(content, 'bg-popover')).toBe(true);
    expect(styleContains(content, 'shadow-md')).toBe(true);
    expect(styleContains(content, 'transition-none')).toBe(true);
    expect(styleContains(content, 'duration-200')).toBe(true);
    expect(styleContains(content, 'data-[open]:animate-in')).toBe(true);
    expect(styleContains(content, 'data-[open]:fade-in-0')).toBe(true);
    expect(styleContains(content, 'data-[open]:zoom-in-95')).toBe(true);
    expect(styleContains(content, 'slide-in-from-left-2')).toBe(true);
    expect(content.style.position).toBe('fixed');
    expect(content.dataset.side).toBe('right');
    expect(content.dataset.align).toBe('start');
    expect(content.style.left).toMatch(/px$/);
    expect(content.style.top).toMatch(/px$/);

    content.dispatchEvent(new Event('pointerenter'));
    trigger.dispatchEvent(new Event('pointerleave'));
    await vi.advanceTimersByTimeAsync(0);
    await flush();
    expect(root.getExposes().open.get()).toBe(true);

    content.dispatchEvent(new Event('pointerleave'));
    await vi.advanceTimersByTimeAsync(0);
    await flush();
    expect(root.getExposes().open.get()).toBe(false);
    expect(content.getExposes().transitionState.get()).toBe('leaving');
    expect(styleContains(content, 'animate-out')).toBe(true);
    expect(styleContains(content, 'fade-out-0')).toBe(true);
    expect(styleContains(content, 'zoom-out-95')).toBe(true);
  });
});
