import { afterEach, describe, expect, it, vi } from 'vitest';
import { styleContains } from '../../test-utils/style';
import { afterTwoHostFrames } from '../../test-utils/host-rendering';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { hoverCardContent, hoverCardRoot, hoverCardTrigger } from '../src/hover-card';

AdaptToWebComponent(hoverCardRoot as any);
AdaptToWebComponent(hoverCardTrigger as any);
AdaptToWebComponent(hoverCardContent as any);

async function flushViewReconciliation(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function advance(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
  await flushViewReconciliation();
}

async function completeTransition(element: any): Promise<void> {
  const exposes = element.getExposes();
  const state = exposes.transitionState.get();
  if (state === 'entering' || state === 'leaving') exposes.controls.complete();
  await flushViewReconciliation();
  if (exposes.transitionState.get() === 'closed') {
    await afterTwoHostFrames();
    await flushViewReconciliation();
  }
}

function createHoverCard(props: Record<string, unknown> = {}) {
  const root = document.createElement('base-hover-card-root') as any;
  const trigger = document.createElement('base-hover-card-trigger') as any;
  const content = document.createElement('base-hover-card-content') as any;
  setElementProps(root, props);
  root.append(trigger, content);
  document.body.appendChild(root);
  return { root, trigger, content };
}

afterEach(async () => {
  document.body.replaceChildren();
  await flushViewReconciliation();
  vi.useRealTimers();
});

describe('prototypes/base: hover-card', () => {
  it('honors open/close delays and keeps the hover bridge open through Transition presence', async () => {
    // T-BASE-HOVER-CARD-0001-CASE-DELAYS
    // T-BASE-HOVER-CARD-CONTENT-0001-CASE-PRESENCE
    vi.useFakeTimers();
    const { root, trigger, content } = createHoverCard({ openDelay: 100, closeDelay: 200 });
    const requests: any[] = [];
    root.addEventListener('openChange', (event: Event) => {
      requests.push((event as CustomEvent).detail);
    });
    await flushViewReconciliation();

    expect(root.getExposes().open.get()).toBe(false);
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);

    trigger.dispatchEvent(new Event('pointerenter'));
    await advance(99);
    expect(root.getExposes().open.get()).toBe(false);

    await advance(1);
    expect(root.getExposes().open.get()).toBe(true);
    expect(content.getExposes().open.get()).toBe(true);
    expect(content.getExposes().transitionState.get()).toBe('entering');
    expect(content.hasAttribute('data-pui-view-detached')).toBe(false);
    expect(requests).toEqual([
      expect.objectContaining({ open: true, reason: 'trigger.pointerenter' }),
    ]);
    await completeTransition(content);

    content.dispatchEvent(new Event('pointerenter'));
    trigger.dispatchEvent(new Event('pointerleave'));
    await advance(250);
    expect(root.getExposes().open.get()).toBe(true);

    content.dispatchEvent(new Event('pointerleave'));
    await advance(199);
    expect(root.getExposes().open.get()).toBe(true);
    await advance(1);
    expect(root.getExposes().open.get()).toBe(false);
    expect(content.getExposes().transitionState.get()).toBe('leaving');
    expect(content.hasAttribute('data-pui-view-detached')).toBe(false);

    await completeTransition(content);
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);
  });

  it('cancels pending interaction intent when pointer returns before a delay completes', async () => {
    // T-BASE-HOVER-CARD-0001-CASE-DELAY-CANCELLATION
    vi.useFakeTimers();
    const { root, trigger } = createHoverCard({ openDelay: 100, closeDelay: 100 });
    await flushViewReconciliation();

    trigger.dispatchEvent(new Event('pointerenter'));
    await advance(50);
    trigger.dispatchEvent(new Event('pointerleave'));
    await advance(100);
    expect(root.getExposes().open.get()).toBe(false);

    trigger.dispatchEvent(new Event('pointerenter'));
    await advance(100);
    expect(root.getExposes().open.get()).toBe(true);
    trigger.dispatchEvent(new Event('pointerleave'));
    await advance(50);
    trigger.dispatchEvent(new Event('pointerenter'));
    await advance(100);
    expect(root.getExposes().open.get()).toBe(true);
  });

  it('keeps scroll-like pointer boundary churn from materializing Content', async () => {
    // Performance invariant: passing several Hover Card triggers while scrolling
    // may produce short enter/leave pairs, but must not cross the delayed-open
    // boundary or attach an Overlay view.
    vi.useFakeTimers();
    const { root, trigger, content } = createHoverCard({ openDelay: 150, closeDelay: 300 });
    const requests: unknown[] = [];
    root.addEventListener('openChange', (event: Event) => {
      requests.push((event as CustomEvent).detail);
    });
    await flushViewReconciliation();

    for (let index = 0; index < 100; index += 1) {
      trigger.dispatchEvent(new Event('pointerenter'));
      trigger.dispatchEvent(new Event('pointerleave'));
    }

    await advance(150);
    expect(root.getExposes().open.get()).toBe(false);
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);
    expect(requests).toEqual([]);
  });

  it('controlled interactions and methods emit requests without replacing owner open', async () => {
    // T-BASE-HOVER-CARD-0001-CASE-CONTROLLED
    // T-BASE-HOVER-CARD-0001-CASE-METHODS
    vi.useFakeTimers();
    const { root, trigger, content } = createHoverCard({
      open: false,
      openDelay: 0,
      closeDelay: 0,
    });
    const requests: any[] = [];
    root.addEventListener('openChange', (event: Event) => {
      requests.push((event as CustomEvent).detail);
    });
    await flushViewReconciliation();

    trigger.dispatchEvent(new Event('pointerenter'));
    await advance(0);
    expect(root.getExposes().open.get()).toBe(false);
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);
    expect(requests.at(-1)).toEqual(
      expect.objectContaining({ open: true, reason: 'trigger.pointerenter' })
    );

    setElementProps(root, { open: true, openDelay: 0, closeDelay: 0 });
    await flushViewReconciliation();
    expect(root.getExposes().open.get()).toBe(true);
    expect(content.getExposes().transitionState.get()).toBe('entering');

    root.getExposes().close('root.method.close');
    expect(root.getExposes().open.get()).toBe(true);
    expect(requests.at(-1)).toEqual(
      expect.objectContaining({ open: false, reason: 'root.method.close' })
    );
  });

  it('opens from trigger focus, suppresses disabled interaction, and owns no button activation', async () => {
    // T-BASE-HOVER-CARD-TRIGGER-0001-CASE-INTERACTION
    // T-BASE-HOVER-CARD-TRIGGER-0001-CASE-INDEPENDENCE
    vi.useFakeTimers();
    const { root, trigger } = createHoverCard({ openDelay: 0, closeDelay: 0 });
    await flushViewReconciliation();

    expect(trigger.getAttribute('role')).not.toBe('button');
    expect(trigger.getExposes()).not.toHaveProperty('pressed');
    expect(trigger.getExposes()).not.toHaveProperty('click');

    trigger.focus();
    await advance(0);
    expect(root.getExposes().open.get()).toBe(true);

    trigger.blur();
    await advance(0);
    expect(root.getExposes().open.get()).toBe(false);

    setElementProps(trigger, { disabled: true });
    await flushViewReconciliation();
    trigger.dispatchEvent(new Event('pointerenter'));
    await advance(0);
    expect(root.getExposes().open.get()).toBe(false);
    expect(trigger.getExposes().disabled.get()).toBe(true);
  });

  it('positions from side and alignment props through the anchored host while exposing Transition controls', async () => {
    // T-BASE-HOVER-CARD-CONTENT-0001-CASE-POSITION
    vi.useFakeTimers();
    const { trigger, content } = createHoverCard({ openDelay: 0 });
    setElementProps(content, { side: 'top', align: 'start', avoidCollisions: false });
    await flushViewReconciliation();

    trigger.dispatchEvent(new Event('pointerenter'));
    await advance(0);
    await flushViewReconciliation();
    expect(content.style.position).toBe('fixed');
    expect(content.dataset.side).toBe('top');
    expect(content.dataset.align).toBe('start');
    expect(content.style.left).toMatch(/px$/);
    expect(content.style.top).toMatch(/px$/);
    expect(styleContains(content, 'absolute')).toBe(true);
    expect(content.getExposes().transitionState.get()).toBe('entering');
    expect(typeof content.getExposes().controls.complete).toBe('function');
  });
});
