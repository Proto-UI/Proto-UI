import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { styleContains } from '../../test-utils/style';
import {
  ShadcnTooltipGroup,
  ShadcnTooltipRoot,
  ShadcnTooltipTrigger,
  ShadcnTooltipContent,
} from '../src/tooltip';

AdaptToWebComponent(ShadcnTooltipGroup);
AdaptToWebComponent(ShadcnTooltipRoot);
AdaptToWebComponent(ShadcnTooltipTrigger);
AdaptToWebComponent(ShadcnTooltipContent);

async function flush(): Promise<void> {
  for (let i = 0; i < 4; i++) await Promise.resolve();
}
async function settle(): Promise<void> {
  await flush();
  await new Promise((r) => setTimeout(r, 0));
  await flush();
}

async function advance(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
  await flush();
}

type OpenChangeRequest = { open: boolean; reason: string | null };

function collectRequests(root: HTMLElement): OpenChangeRequest[] {
  const requests: OpenChangeRequest[] = [];
  root.addEventListener('openChange', (event: Event) => {
    requests.push((event as CustomEvent<OpenChangeRequest>).detail);
  });
  return requests;
}

function appendTooltip(parent: HTMLElement, props: Record<string, unknown> = {}) {
  const root = document.createElement(ShadcnTooltipRoot.name) as any;
  const trigger = document.createElement(ShadcnTooltipTrigger.name) as any;
  const content = document.createElement(ShadcnTooltipContent.name) as any;
  setElementProps(root, props);
  root.append(trigger, content);
  parent.appendChild(root);
  return { root, trigger, content };
}

afterEach(async () => {
  document.body.replaceChildren();
  await flush();
  vi.useRealTimers();
});

describe('prototypes/shadcn: tooltip', () => {
  it('renders group, root, trigger, content with correct entry names and visual grammar', async () => {
    expect(ShadcnTooltipGroup.name).toBe('shadcn-tooltip-group');
    expect(ShadcnTooltipRoot.name).toBe('shadcn-tooltip-root');
    expect(ShadcnTooltipTrigger.name).toBe('shadcn-tooltip-trigger');
    expect(ShadcnTooltipContent.name).toBe('shadcn-tooltip-content');

    const group = document.createElement(ShadcnTooltipGroup.name) as any;
    const root = document.createElement(ShadcnTooltipRoot.name) as any;
    const trigger = document.createElement(ShadcnTooltipTrigger.name) as any;
    const content = document.createElement(ShadcnTooltipContent.name) as any;
    group.appendChild(root);
    root.append(trigger, content);
    document.body.appendChild(group);
    await settle();

    expect(styleContains(group, 'inline-flex')).toBe(true);
    expect(styleContains(trigger, 'inline-flex')).toBe(true);
    expect(styleContains(trigger, 'cursor-pointer')).toBe(true);
  });

  it('renders the opened Content with the complete rounded popover surface', async () => {
    const group = document.createElement(ShadcnTooltipGroup.name) as any;
    const root = document.createElement(ShadcnTooltipRoot.name) as any;
    const trigger = document.createElement(ShadcnTooltipTrigger.name) as any;
    const content = document.createElement(ShadcnTooltipContent.name) as any;
    setElementProps(root, { defaultOpen: true, openDelay: 0, closeDelay: 0 });
    root.append(trigger, content);
    group.appendChild(root);
    document.body.appendChild(group);
    await settle();

    expect(content.getExposes().open.get()).toBe(true);
    for (const token of [
      'z-50',
      'overflow-hidden',
      'rounded-md',
      'border',
      'bg-popover',
      'px-3',
      'py-1.5',
      'text-xs',
      'text-popover-foreground',
      'shadow-md',
    ]) {
      expect(styleContains(content, token), token).toBe(true);
    }
  });

  it('projects runtime-managed press state into scale feedback without authoring activation', async () => {
    const root = document.createElement(ShadcnTooltipRoot.name) as any;
    const trigger = document.createElement(ShadcnTooltipTrigger.name) as any;
    const requests: unknown[] = [];
    root.addEventListener('openChange', (event: Event) => {
      requests.push((event as CustomEvent).detail);
    });
    root.appendChild(trigger);
    document.body.appendChild(root);
    await settle();

    expect(trigger.getAttribute('role')).toBeNull();
    expect(styleContains(trigger, 'scale-[0.98]')).toBe(false);

    trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await flush();
    expect(styleContains(trigger, 'scale-[0.98]')).toBe(true);

    trigger.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    await flush();
    expect(styleContains(trigger, 'scale-[0.98]')).toBe(false);

    setElementProps(root, { disabled: true });
    await settle();
    trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await flush();
    expect(styleContains(trigger, 'scale-[0.98]')).toBe(false);
    expect(requests).toEqual([]);
  });

  it('preserves configured 500ms open and 150ms close timing while cancelling disabled work', async () => {
    vi.useFakeTimers();
    const { root, trigger } = appendTooltip(document.body, {
      openDelay: 500,
      closeDelay: 150,
    });
    const requests = collectRequests(root);
    await flush();

    trigger.dispatchEvent(new Event('pointerenter'));
    await advance(499);
    expect(root.getExposes().open.get()).toBe(false);
    expect(requests).toEqual([]);

    trigger.dispatchEvent(new Event('pointerleave'));
    await advance(1);
    await advance(500);
    expect(root.getExposes().open.get()).toBe(false);
    expect(requests).toEqual([]);

    trigger.dispatchEvent(new Event('pointerenter'));
    await advance(499);
    expect(root.getExposes().open.get()).toBe(false);
    await advance(1);
    expect(root.getExposes().open.get()).toBe(true);
    expect(requests.at(-1)).toMatchObject({ open: true, reason: 'trigger.pointerenter' });

    trigger.dispatchEvent(new Event('pointerleave'));
    await advance(149);
    expect(root.getExposes().open.get()).toBe(true);
    await advance(1);
    expect(root.getExposes().open.get()).toBe(false);
    expect(requests.at(-1)).toMatchObject({ open: false, reason: 'trigger.pointerleave' });

    const settledRequestCount = requests.length;
    trigger.dispatchEvent(new Event('pointerenter'));
    await advance(250);
    setElementProps(root, { disabled: true, openDelay: 500, closeDelay: 150 });
    await flush();
    await advance(250);
    expect(root.getExposes().open.get()).toBe(false);
    expect(requests).toHaveLength(settledRequestCount);

    trigger.dispatchEvent(new Event('pointerenter'));
    await advance(500);
    expect(root.getExposes().open.get()).toBe(false);
    expect(requests).toHaveLength(settledRequestCount);
  });

  it('cancels pending Root and Group timers when their owners are disposed', async () => {
    vi.useFakeTimers();
    const pendingRoot = appendTooltip(document.body, { openDelay: 500, closeDelay: 150 });
    const rootRequests = collectRequests(pendingRoot.root);
    await flush();

    pendingRoot.trigger.dispatchEvent(new Event('pointerenter'));
    await advance(250);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    pendingRoot.root.remove();
    await flush();
    expect(vi.getTimerCount()).toBe(0);
    await advance(250);
    expect(rootRequests).toEqual([]);

    const group = document.createElement(ShadcnTooltipGroup.name) as any;
    setElementProps(group, { openDelay: 0, closeDelay: 0, skipDelay: 300 });
    document.body.appendChild(group);
    const activeRoot = document.createElement(ShadcnTooltipRoot.name) as any;
    const activeTrigger = document.createElement(ShadcnTooltipTrigger.name) as any;
    activeRoot.appendChild(activeTrigger);
    group.appendChild(activeRoot);
    await flush();

    activeTrigger.dispatchEvent(new Event('pointerenter'));
    await advance(0);
    activeTrigger.dispatchEvent(new Event('pointerleave'));
    await advance(0);
    expect(activeRoot.getExposes().open.get()).toBe(false);
    expect(vi.getTimerCount()).toBe(1);
    group.remove();
    await flush();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('hands a warm Group directly to one sibling owner without an overlap frame', async () => {
    vi.useFakeTimers();
    const group = document.createElement(ShadcnTooltipGroup.name) as any;
    setElementProps(group, { openDelay: 500, closeDelay: 150, skipDelay: 300 });
    document.body.appendChild(group);
    const first = appendTooltip(group);
    const second = appendTooltip(group);
    const firstRequests = collectRequests(first.root);
    const secondRequests = collectRequests(second.root);
    const openOwnerCount = () =>
      [first.root, second.root].filter((root) => root.getExposes().open.get()).length;
    await flush();

    first.trigger.dispatchEvent(new Event('pointerenter'));
    await advance(499);
    expect(openOwnerCount()).toBe(0);
    await advance(1);
    expect(first.root.getExposes().open.get()).toBe(true);
    expect(openOwnerCount()).toBe(1);

    second.trigger.dispatchEvent(new Event('pointerenter'));
    await advance(0);
    expect(first.root.getExposes().open.get()).toBe(false);
    expect(second.root.getExposes().open.get()).toBe(true);
    expect(openOwnerCount()).toBe(1);
    expect(firstRequests.at(-1)).toMatchObject({ open: false, reason: 'group.other-open' });
    expect(secondRequests.at(-1)).toMatchObject({ open: true, reason: 'trigger.pointerenter' });

    first.trigger.dispatchEvent(new Event('pointerleave'));
    second.trigger.dispatchEvent(new Event('pointerleave'));
    await advance(149);
    expect(openOwnerCount()).toBe(1);
    await advance(1);
    expect(openOwnerCount()).toBe(0);

    first.trigger.dispatchEvent(new Event('pointerenter'));
    await advance(0);
    expect(first.root.getExposes().open.get()).toBe(true);
    expect(second.root.getExposes().open.get()).toBe(false);
    expect(openOwnerCount()).toBe(1);
  });
});
