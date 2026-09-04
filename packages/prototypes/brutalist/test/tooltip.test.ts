import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { styleContains } from '../../test-utils/style';
import * as tooltipPackage from '../src/tooltip';

const {
  BrutalistTooltipContent,
  BrutalistTooltipGroup,
  BrutalistTooltipRoot,
  BrutalistTooltipTrigger,
} = tooltipPackage;

const TooltipGroupElement = AdaptToWebComponent(BrutalistTooltipGroup);
const TooltipRootElement = AdaptToWebComponent(BrutalistTooltipRoot);
const TooltipTriggerElement = AdaptToWebComponent(BrutalistTooltipTrigger);
const TooltipContentElement = AdaptToWebComponent(BrutalistTooltipContent);

async function flush(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe('prototypes/brutalist: tooltip', () => {
  it('publishes the complete four-entry Tooltip package surface with a transparent Trigger', async () => {
    vi.useFakeTimers();
    expect(Object.keys(tooltipPackage).sort()).toEqual([
      'BrutalistTooltipContent',
      'BrutalistTooltipGroup',
      'BrutalistTooltipRoot',
      'BrutalistTooltipTrigger',
    ]);

    const root = new TooltipRootElement();
    const trigger = new TooltipTriggerElement();
    root.append(trigger);
    document.body.append(root);
    await flush();
    expect(Object.keys(trigger.getExposes()).sort()).toEqual([
      'disabled',
      'focusSelf',
      'focusVisible',
      'focused',
      'hovered',
    ]);
    expect(trigger.getAttribute('data-pui-style')).toBeNull();
  });

  it('preserves Base Group timing and same-domain warm intent across sibling Tooltips', async () => {
    vi.useFakeTimers();
    const group = new TooltipGroupElement();
    const rootA = new TooltipRootElement();
    const triggerA = new TooltipTriggerElement();
    const contentA = new TooltipContentElement();
    const rootB = new TooltipRootElement();
    const triggerB = new TooltipTriggerElement();
    const contentB = new TooltipContentElement();
    setElementProps(group, { openDelay: 50, closeDelay: 0, skipDelay: 300 });
    rootA.append(triggerA, contentA);
    rootB.append(triggerB, contentB);
    group.append(rootA, rootB);
    document.body.append(group);
    await flush();

    triggerA.dispatchEvent(new Event('pointerenter'));
    await vi.advanceTimersByTimeAsync(49);
    expect(rootA.getExposes().open.get()).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(rootA.getExposes().open.get()).toBe(true);

    triggerA.dispatchEvent(new Event('pointerleave'));
    await flush();
    expect(rootA.getExposes().open.get()).toBe(false);

    // The shared Group remains warm, so the sibling opens without the cold delay.
    triggerB.dispatchEvent(new Event('pointerenter'));
    await flush();
    expect(rootB.getExposes().open.get()).toBe(true);
    expect(contentB.getAttribute('role')).toBe('tooltip');
  });

  it('cleans owned describedBy on Content teardown and keeps rendered Content supplementary', async () => {
    vi.useFakeTimers();
    const root = new TooltipRootElement();
    const trigger = new TooltipTriggerElement();
    const content = new TooltipContentElement();
    setElementProps(root, { openDelay: 0, closeDelay: 0 });
    root.append(trigger, content);
    document.body.append(root);
    await flush();

    trigger.dispatchEvent(new Event('pointerenter'));
    await flush();
    expect(trigger.getAttribute('aria-describedby')).toBe(content.id);
    expect(content.getAttribute('role')).toBe('tooltip');
    expect(content.hasAttribute('tabindex')).toBe(false);
    expect(content.querySelector('a,button,input,select,textarea,[tabindex]')).toBeNull();

    content.remove();
    await flush();
    expect(trigger.hasAttribute('aria-describedby')).toBe(false);
  });

  it('inherits the current Base interaction and accessibility protocol with a visual-only delta', async () => {
    vi.useFakeTimers();
    const root = new TooltipRootElement();
    const trigger = new TooltipTriggerElement();
    const content = new TooltipContentElement();
    setElementProps(root, { openDelay: 0, closeDelay: 0 });
    root.append(trigger, content);
    document.body.appendChild(root);
    await flush();

    expect(root.getExposes().open.get()).toBe(false);

    trigger.dispatchEvent(new Event('pointerenter'));
    await flush();
    expect(root.getExposes().open.get()).toBe(true);
    expect(content.getExposes().open.get()).toBe(true);
    expect(trigger.getAttribute('aria-describedby')).toBe(content.id);
    expect(content.getAttribute('role')).toBe('tooltip');
    expect(styleContains(content, 'rounded-none')).toBe(true);
    expect(styleContains(content, 'border-2')).toBe(true);
    expect(styleContains(content, 'bg-foreground')).toBe(true);
    expect(styleContains(content, 'font-mono')).toBe(true);
    expect(styleContains(content, 'shadow-[4px_4px_0_0_var(--pui-foreground)]')).toBe(true);

    trigger.dispatchEvent(new Event('pointerleave'));
    await flush();
    expect(root.getExposes().open.get()).toBe(false);
  });
});
