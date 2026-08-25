import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WebComponentAdapterElement } from '@proto.ui/adapter-web-component';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { styleContains } from '../../test-utils/style';
import { hoverCardContent, hoverCardRoot, hoverCardTrigger } from '../src/hover-card';

type HoverRootElement = WebComponentAdapterElement<typeof hoverCardRoot>;
type HoverTriggerElement = WebComponentAdapterElement<typeof hoverCardTrigger>;
type HoverContentElement = WebComponentAdapterElement<typeof hoverCardContent>;

AdaptToWebComponent(hoverCardRoot);
AdaptToWebComponent(hoverCardTrigger);
AdaptToWebComponent(hoverCardContent);

async function flush(): Promise<void> {
  for (let index = 0; index < 4; index += 1) await Promise.resolve();
}

async function advance(milliseconds: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(milliseconds);
  await flush();
}

function createHoverCard(options?: {
  root?: Record<string, unknown>;
  trigger?: Record<string, unknown>;
  content?: Record<string, unknown>;
}) {
  const root = document.createElement(hoverCardRoot.name) as HoverRootElement;
  const trigger = document.createElement(hoverCardTrigger.name) as HoverTriggerElement;
  const content = document.createElement(hoverCardContent.name) as HoverContentElement;
  setElementProps(root, options?.root ?? { openDelay: 0, closeDelay: 0 });
  setElementProps(trigger, options?.trigger ?? {});
  setElementProps(
    content,
    options?.content ?? { side: 'right', align: 'start', avoidCollisions: false }
  );
  trigger.textContent = 'Profile';
  content.textContent = 'Profile details';
  root.append(trigger, content);
  document.body.appendChild(root);
  return { root, trigger, content };
}

afterEach(async () => {
  document.body.replaceChildren();
  await flush();
  vi.useRealTimers();
});

describe('prototypes/brutalist: hover-card', () => {
  it('projects the named Base-backed Root and layout-only surface', async () => {
    // T-BRUTALIST-HOVER-CARD-0001-CASE-1
    vi.useFakeTimers();
    const { root, trigger, content } = createHoverCard();
    await flush();

    expect(hoverCardRoot.name).toBe('brutalist-hover-card-root');
    expect(root.getExposes().open.get()).toBe(false);
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);
    for (const token of ['relative', 'inline-flex', 'items-start']) {
      expect(styleContains(root, token)).toBe(true);
    }
    for (const token of ['border-2', 'shadow-[3px_3px_0_0_#000]', 'bg-main']) {
      expect(styleContains(root, token)).toBe(false);
    }

    trigger.dispatchEvent(new PointerEvent('pointerenter'));
    await advance(0);
    expect(root.getExposes().open.get()).toBe(true);
    expect(content.hasAttribute('data-pui-view-detached')).toBe(false);

    root.getExposes().close('test.close');
    await flush();
    expect(root.getExposes().open.get()).toBe(false);
  });

  it('activates Trigger pair and interaction states while disabled gates opening', async () => {
    // T-BRUTALIST-HOVER-CARD-0001-CASE-2
    vi.useFakeTimers();
    const { root, trigger } = createHoverCard();
    await flush();

    expect(hoverCardTrigger.name).toBe('brutalist-hover-card-trigger');
    for (const token of [
      'inline-flex',
      'rounded-none',
      'border-2',
      'border-black',
      'bg-main',
      'text-main-foreground',
      'font-bold',
      'uppercase',
      'shadow-[3px_3px_0_0_#000]',
    ]) {
      expect(styleContains(trigger, token)).toBe(true);
    }

    trigger.dispatchEvent(new PointerEvent('pointerenter'));
    await advance(0);
    expect(trigger.getExposes().hovered.get()).toBe(true);
    expect(trigger.hasAttribute('data-hovered')).toBe(true);
    expect(styleContains(trigger, 'data-[hovered]:-translate-x-px')).toBe(true);
    expect(styleContains(trigger, 'data-[hovered]:-translate-y-px')).toBe(true);
    expect(styleContains(trigger, 'data-[hovered]:shadow-[4px_4px_0_0_#000]')).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    const matchesSpy = vi.spyOn(trigger, 'matches').mockReturnValue(true);
    trigger.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    await advance(0);
    expect(trigger.getExposes().focusVisible.get()).toBe(true);
    expect(styleContains(trigger, 'data-[focus-visible]:ring-2')).toBe(true);
    expect(styleContains(trigger, 'data-[focus-visible]:ring-ring')).toBe(true);
    expect(styleContains(trigger, 'data-[focus-visible]:ring-offset-2')).toBe(true);

    root.getExposes().close('test.close');
    await advance(0);
    setElementProps(trigger, { disabled: true });
    await flush();
    trigger.dispatchEvent(new PointerEvent('pointerenter'));
    await advance(0);
    expect(trigger.getExposes().disabled.get()).toBe(true);
    expect(root.getExposes().open.get()).toBe(false);
    expect(styleContains(trigger, 'data-[disabled]:pointer-events-none')).toBe(true);
    expect(styleContains(trigger, 'data-[disabled]:opacity-50')).toBe(true);
    expect(styleContains(trigger, 'bg-main')).toBe(true);
    expect(styleContains(trigger, 'text-main-foreground')).toBe(true);
  });

  it('keeps the 200ms fade-zoom panel present through enter and leave', async () => {
    // T-BRUTALIST-HOVER-CARD-0001-CASE-3
    vi.useFakeTimers();
    const { root, trigger, content } = createHoverCard();
    await flush();

    expect(hoverCardContent.name).toBe('brutalist-hover-card-content');
    expect(content.getExposes().transitionState.get()).toBe('closed');
    expect(content.getExposes().isPresent.get()).toBe(false);
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);

    trigger.dispatchEvent(new PointerEvent('pointerenter'));
    await advance(0);
    expect(root.getExposes().open.get()).toBe(true);
    expect(content.getExposes().transitionState.get()).toBe('entering');
    expect(content.getExposes().isPresent.get()).toBe(true);
    expect(content.parentElement).toBe(document.body);
    expect(content.style.position).toBe('fixed');
    expect(content.dataset.side).toBe('right');
    expect(content.dataset.align).toBe('start');
    for (const token of [
      'w-64',
      'p-4',
      'text-sm',
      'leading-6',
      'duration-200',
      'rounded-none',
      'border-2',
      'border-black',
      'bg-secondary-background',
      'text-foreground',
      'shadow-[3px_3px_0_0_#000]',
      'data-[open]:animate-in',
      'data-[open]:fade-in-0',
      'data-[open]:zoom-in-95',
      'slide-in-from-left-2',
    ]) {
      expect(styleContains(content, token)).toBe(true);
    }

    await advance(199);
    expect(content.getExposes().transitionState.get()).toBe('entering');
    await advance(1);
    expect(content.getExposes().transitionState.get()).toBe('entered');

    root.getExposes().close('test.close');
    await flush();
    expect(content.getExposes().transitionState.get()).toBe('leaving');
    expect(content.getExposes().isPresent.get()).toBe(true);
    expect(content.hasAttribute('data-pui-view-detached')).toBe(false);
    expect(styleContains(content, 'animate-out')).toBe(true);
    expect(styleContains(content, 'fade-out-0')).toBe(true);
    expect(styleContains(content, 'zoom-out-95')).toBe(true);
    await advance(199);
    expect(content.getExposes().transitionState.get()).toBe('leaving');
    await advance(1);
    expect(content.getExposes().transitionState.get()).toBe('closed');
    expect(content.getExposes().isPresent.get()).toBe(false);
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);
  });
});
