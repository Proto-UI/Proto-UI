import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  tooltipContent,
  tooltipGroup,
  tooltipRoot,
  tooltipTrigger,
  type TooltipGroupProps,
  type TooltipRootProps,
} from '../src/tooltip';

const TooltipGroupElement = AdaptToWebComponent(tooltipGroup);
const TooltipRootElement = AdaptToWebComponent(tooltipRoot);
const TooltipTriggerElement = AdaptToWebComponent(tooltipTrigger);
const TooltipContentElement = AdaptToWebComponent(tooltipContent);

type OpenChangeRequest = { open: boolean; reason: string | null };

async function flushViewReconciliation(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function advance(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
  await flushViewReconciliation();
}

async function completeTransition(content: InstanceType<typeof TooltipContentElement>) {
  const exposes = content.getExposes();
  if (exposes.transitionState.get() === 'entering' || exposes.transitionState.get() === 'leaving') {
    exposes.controls.complete();
  }
  await flushViewReconciliation();
}

function createTooltip(props: Partial<TooltipRootProps> = {}) {
  const root = new TooltipRootElement();
  const trigger = new TooltipTriggerElement();
  const content = new TooltipContentElement();
  setElementProps(root, props);
  root.append(trigger, content);
  document.body.appendChild(root);
  return { root, trigger, content };
}

function appendTooltip(parent: HTMLElement, props: Partial<TooltipRootProps> = {}) {
  const root = new TooltipRootElement();
  const trigger = new TooltipTriggerElement();
  const content = new TooltipContentElement();
  setElementProps(root, props);
  root.append(trigger, content);
  parent.appendChild(root);
  return { root, trigger, content };
}

function collectRequests(root: InstanceType<typeof TooltipRootElement>): OpenChangeRequest[] {
  const requests: OpenChangeRequest[] = [];
  root.addEventListener('openChange', (event) => {
    requests.push((event as CustomEvent<OpenChangeRequest>).detail);
  });
  return requests;
}

afterEach(async () => {
  document.body.replaceChildren();
  await flushViewReconciliation();
  vi.useRealTimers();
});

describe('prototypes/base: tooltip', () => {
  it('delays pointer opening, reverses pending intent, and delays closing', async () => {
    vi.useFakeTimers();
    const { root, trigger } = createTooltip({ openDelay: 100, closeDelay: 50 });
    await flushViewReconciliation();

    trigger.dispatchEvent(new Event('pointerenter'));
    await advance(99);
    expect(root.getExposes().open.get()).toBe(false);
    trigger.dispatchEvent(new Event('pointerleave'));
    await advance(1);
    expect(root.getExposes().open.get()).toBe(false);

    trigger.dispatchEvent(new Event('pointerenter'));
    await advance(100);
    expect(root.getExposes().open.get()).toBe(true);
    trigger.dispatchEvent(new Event('pointerleave'));
    await advance(49);
    expect(root.getExposes().open.get()).toBe(true);
    await advance(1);
    expect(root.getExposes().open.get()).toBe(false);
  });

  it('opens immediately from focus and keeps hoverable content open', async () => {
    vi.useFakeTimers();
    const { root, trigger, content } = createTooltip({ openDelay: 500, closeDelay: 80 });
    await flushViewReconciliation();

    trigger.focus();
    await advance(0);
    expect(root.getExposes().open.get()).toBe(true);
    trigger.blur();
    content.dispatchEvent(new Event('pointerenter'));
    await advance(100);
    expect(root.getExposes().open.get()).toBe(true);
    content.dispatchEvent(new Event('pointerleave'));
    await advance(80);
    expect(root.getExposes().open.get()).toBe(false);
  });

  it('preserves controlled ownership and routes Escape as a close request', async () => {
    vi.useFakeTimers();
    const { root, trigger, content } = createTooltip({ open: false, openDelay: 0, closeDelay: 0 });
    const requests = collectRequests(root);
    await flushViewReconciliation();

    trigger.dispatchEvent(new Event('pointerenter'));
    await advance(0);
    expect(root.getExposes().open.get()).toBe(false);
    expect(requests.at(-1)).toMatchObject({ open: true, reason: 'trigger.pointerenter' });

    setElementProps(root, { open: true, openDelay: 0, closeDelay: 0 });
    await flushViewReconciliation();
    await completeTransition(content);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await advance(0);

    expect(root.getExposes().open.get()).toBe(true);
    expect(requests.at(-1)).toMatchObject({ open: false, reason: 'escape' });
  });

  it('projects tooltip semantics additively only while open', async () => {
    vi.useFakeTimers();
    const { root, trigger, content } = createTooltip({ openDelay: 0, closeDelay: 0 });
    trigger.setAttribute('aria-describedby', 'host-help');
    await flushViewReconciliation();

    expect(trigger.getAttribute('aria-describedby')).toBe('host-help');
    trigger.dispatchEvent(new Event('pointerenter'));
    await advance(0);
    expect(content.id).toMatch(/^pui-tooltip-\d+-content$/);
    expect(content.getAttribute('role')).toBe('tooltip');
    expect(trigger.getAttribute('aria-describedby')).toBe(`host-help ${content.id}`);

    trigger.dispatchEvent(new Event('pointerleave'));
    await advance(0);
    expect(root.getExposes().open.get()).toBe(false);
    expect(trigger.getAttribute('aria-describedby')).toBe('host-help');
  });

  it('closes when disabled and ignores later trigger interaction', async () => {
    vi.useFakeTimers();
    const { root, trigger } = createTooltip({ defaultOpen: true, openDelay: 0, closeDelay: 0 });
    await flushViewReconciliation();
    expect(root.getExposes().open.get()).toBe(true);

    setElementProps(root, { defaultOpen: true, disabled: true, openDelay: 0, closeDelay: 0 });
    await advance(0);
    expect(root.getExposes().open.get()).toBe(false);
    trigger.dispatchEvent(new Event('pointerenter'));
    await advance(0);
    expect(root.getExposes().open.get()).toBe(false);
  });
});

describe('prototypes/base: tooltip group', () => {
  it('warms sibling tooltips, coordinates one active owner, then restores delay', async () => {
    vi.useFakeTimers();
    const group = new TooltipGroupElement();
    setElementProps(group, {
      openDelay: 100,
      closeDelay: 0,
      skipDelay: 50,
    } satisfies TooltipGroupProps);
    document.body.appendChild(group);
    const first = appendTooltip(group);
    const second = appendTooltip(group);
    await flushViewReconciliation();

    first.trigger.dispatchEvent(new Event('pointerenter'));
    await advance(100);
    expect(first.root.getExposes().open.get()).toBe(true);

    second.trigger.dispatchEvent(new Event('pointerenter'));
    await advance(0);
    expect(second.root.getExposes().open.get()).toBe(true);
    expect(first.root.getExposes().open.get()).toBe(false);
    expect(first.content.getExposes().transitionState.get()).toBe('closed');
    expect(first.content.getExposes().isPresent.get()).toBe(false);

    second.trigger.dispatchEvent(new Event('pointerleave'));
    await advance(0);
    expect(second.root.getExposes().open.get()).toBe(false);
    expect(second.content.getExposes().transitionState.get()).toBe('leaving');
    expect(second.content.getExposes().isPresent.get()).toBe(true);
    await advance(50);

    first.trigger.dispatchEvent(new Event('pointerleave'));
    first.trigger.dispatchEvent(new Event('pointerenter'));
    await advance(99);
    expect(first.root.getExposes().open.get()).toBe(false);
    await advance(1);
    expect(first.root.getExposes().open.get()).toBe(true);
    expect(second.content.getExposes().transitionState.get()).toBe('closed');
    expect(second.content.getExposes().isPresent.get()).toBe(false);
  });

  it('requests the previous controlled owner to close without mutating it', async () => {
    vi.useFakeTimers();
    const group = new TooltipGroupElement();
    setElementProps(group, { openDelay: 0, closeDelay: 0, skipDelay: 50 });
    document.body.appendChild(group);
    const first = appendTooltip(group, { open: true });
    const second = appendTooltip(group);
    const requests = collectRequests(first.root);
    await flushViewReconciliation();

    second.trigger.dispatchEvent(new Event('pointerenter'));
    await advance(0);

    expect(second.root.getExposes().open.get()).toBe(true);
    expect(first.root.getExposes().open.get()).toBe(true);
    expect(requests.at(-1)).toMatchObject({ open: false, reason: 'group.other-open' });
  });
});
