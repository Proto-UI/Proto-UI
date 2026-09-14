import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { styleContains } from '../../test-utils/style';
import * as ShadcnPackage from '../src';
import * as tooltipFamily from '../src/tooltip';
import type {
  ShadcnTooltipContentProps,
  ShadcnTooltipGroupProps,
  ShadcnTooltipRootProps,
} from '../src/tooltip';

type HasUnsupportedRootApi =
  Extract<
    'asChild' | 'delayDuration' | 'disableHoverableContent',
    keyof ShadcnTooltipRootProps
  > extends never
    ? false
    : true;
type HasUnsupportedGroupApi =
  Extract<
    'asChild' | 'delayDuration' | 'disableHoverableContent',
    keyof ShadcnTooltipGroupProps
  > extends never
    ? false
    : true;
type HasUnsupportedContentApi =
  Extract<'asChild' | 'forceMount', keyof ShadcnTooltipContentProps> extends never ? false : true;

const { ShadcnTooltipContent, ShadcnTooltipGroup, ShadcnTooltipRoot, ShadcnTooltipTrigger } =
  tooltipFamily;
const TooltipGroupElement = AdaptToWebComponent(ShadcnTooltipGroup);
const TooltipRootElement = AdaptToWebComponent(ShadcnTooltipRoot);
const TooltipTriggerElement = AdaptToWebComponent(ShadcnTooltipTrigger);
const TooltipContentElement = AdaptToWebComponent(ShadcnTooltipContent);

async function flush(): Promise<void> {
  for (let index = 0; index < 4; index += 1) await Promise.resolve();
}

async function advance(milliseconds: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(milliseconds);
  await flush();
}

function appendTooltip(parent: HTMLElement, props: Record<string, unknown> = {}) {
  const root = new TooltipRootElement();
  const trigger = new TooltipTriggerElement();
  const content = new TooltipContentElement();
  setElementProps(root, props as any);
  root.append(trigger, content);
  parent.appendChild(root);
  return { root, trigger, content };
}

function exportedPrototypeName(value: unknown): string | null {
  if (!value || typeof value !== 'object' || !('name' in value)) return null;
  return typeof value.name === 'string' ? value.name : null;
}

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe('prototypes/shadcn: tooltip', () => {
  it('exports only Group, Root, Trigger, and Content through family and package entries', () => {
    expect(
      Object.fromEntries(
        Object.entries(tooltipFamily).map(([name, value]) => [name, exportedPrototypeName(value)])
      )
    ).toEqual({
      ShadcnTooltipContent: 'shadcn-tooltip-content',
      ShadcnTooltipGroup: 'shadcn-tooltip-group',
      ShadcnTooltipRoot: 'shadcn-tooltip-root',
      ShadcnTooltipTrigger: 'shadcn-tooltip-trigger',
      shadcnTooltipContent: 'shadcn-tooltip-content',
      shadcnTooltipGroup: 'shadcn-tooltip-group',
      shadcnTooltipRoot: 'shadcn-tooltip-root',
      shadcnTooltipTrigger: 'shadcn-tooltip-trigger',
    });
    expect(
      Object.fromEntries(
        Object.entries(ShadcnPackage)
          .filter(([name]) => name.toLowerCase().includes('tooltip'))
          .map(([name, value]) => [name, exportedPrototypeName(value)])
      )
    ).toEqual({
      ShadcnTooltipContent: 'shadcn-tooltip-content',
      ShadcnTooltipGroup: 'shadcn-tooltip-group',
      ShadcnTooltipRoot: 'shadcn-tooltip-root',
      ShadcnTooltipTrigger: 'shadcn-tooltip-trigger',
      shadcnTooltipContent: 'shadcn-tooltip-content',
      shadcnTooltipGroup: 'shadcn-tooltip-group',
      shadcnTooltipRoot: 'shadcn-tooltip-root',
      shadcnTooltipTrigger: 'shadcn-tooltip-trigger',
    });
    expect(Object.keys(tooltipFamily).some((name) => /arrow|portal/i.test(name))).toBe(false);
    expectTypeOf<HasUnsupportedRootApi>().toEqualTypeOf<false>();
    expectTypeOf<HasUnsupportedGroupApi>().toEqualTypeOf<false>();
    expectTypeOf<HasUnsupportedContentApi>().toEqualTypeOf<false>();
  });

  it('projects the governed Group, Trigger, and opened Content surfaces', async () => {
    const group = new TooltipGroupElement();
    const { trigger, content } = appendTooltip(group, { defaultOpen: true });
    document.body.append(group);
    await flush();

    for (const token of ['inline-flex']) expect(styleContains(group, token), token).toBe(true);
    for (const token of ['inline-flex', 'cursor-pointer', 'outline-none']) {
      expect(styleContains(trigger, token), token).toBe(true);
    }
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
    expect(content.getAttribute('role')).toBe('tooltip');
    expect(content.hasAttribute('tabindex')).toBe(false);
  });

  it('derives hover, focus-visible, and press paint without adding activation ownership', async () => {
    vi.useFakeTimers();
    const { root, trigger } = appendTooltip(document.body, { openDelay: 0, closeDelay: 0 });
    await flush();

    expect(trigger.getAttribute('role')).toBeNull();
    expect(Object.keys(trigger.getExposes()).sort()).toEqual([
      'disabled',
      'focusSelf',
      'focusVisible',
      'focused',
      'hovered',
    ]);

    trigger.dispatchEvent(new Event('pointerenter'));
    await advance(0);
    expect(root.getExposes().open.get()).toBe(true);
    expect(styleContains(trigger, 'data-[hovered]:opacity-70')).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    const matchesSpy = vi.spyOn(trigger, 'matches').mockReturnValue(true);
    trigger.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    await advance(0);
    expect(trigger.getExposes().focusVisible.get()).toBe(true);
    expect(styleContains(trigger, 'data-[focus-visible]:ring-2')).toBe(true);
    expect(styleContains(trigger, 'data-[focus-visible]:ring-ring')).toBe(true);
    expect(styleContains(trigger, 'data-[focus-visible]:ring-offset-2')).toBe(true);
    expect(styleContains(trigger, 'data-[focus-visible]:ring-offset-background')).toBe(true);
    matchesSpy.mockRestore();

    trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await advance(0);
    expect(styleContains(trigger, 'scale-[0.98]')).toBe(true);
    trigger.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    await advance(0);
    expect(styleContains(trigger, 'scale-[0.98]')).toBe(false);

    setElementProps(root, { disabled: true, openDelay: 0, closeDelay: 0 } as any);
    await advance(0);
    trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await advance(0);
    expect(styleContains(trigger, 'scale-[0.98]')).toBe(false);
  });

  it('keeps Base 700/100/300ms defaults, warm sibling handoff, and disposal safety', async () => {
    vi.useFakeTimers();
    const group = new TooltipGroupElement();
    const first = appendTooltip(group);
    const second = appendTooltip(group);
    document.body.append(group);
    await flush();

    first.trigger.dispatchEvent(new Event('pointerenter'));
    await advance(699);
    expect(first.root.getExposes().open.get()).toBe(false);
    await advance(1);
    expect(first.root.getExposes().open.get()).toBe(true);

    first.trigger.dispatchEvent(new Event('pointerleave'));
    await advance(99);
    expect(first.root.getExposes().open.get()).toBe(true);
    await advance(1);
    expect(first.root.getExposes().open.get()).toBe(false);

    second.trigger.dispatchEvent(new Event('pointerenter'));
    await advance(0);
    expect(second.root.getExposes().open.get()).toBe(true);
    expect(first.root.getExposes().open.get()).toBe(false);

    second.trigger.dispatchEvent(new Event('pointerleave'));
    await advance(100);
    expect(second.root.getExposes().open.get()).toBe(false);
    await advance(300);

    first.trigger.dispatchEvent(new Event('pointerenter'));
    await advance(699);
    expect(first.root.getExposes().open.get()).toBe(false);
    first.root.remove();
    await flush();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('publishes describedBy only while same-domain Content exists and keeps Content supplementary', async () => {
    vi.useFakeTimers();
    const root = new TooltipRootElement();
    const trigger = new TooltipTriggerElement();
    setElementProps(root, { openDelay: 0, closeDelay: 0 } as any);
    root.append(trigger);
    document.body.append(root);
    await flush();

    trigger.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    await advance(0);
    expect(trigger.hasAttribute('aria-describedby')).toBe(false);

    const content = new TooltipContentElement();
    content.append(document.createTextNode('Supplementary description'));
    root.append(content);
    await advance(0);
    expect(trigger.getAttribute('aria-describedby')).toBe(content.id);
    expect(root.contains(content)).toBe(false);
    expect(document.body.contains(content)).toBe(true);
    expect(content.getAttribute('role')).toBe('tooltip');
    expect(content.hasAttribute('tabindex')).toBe(false);
    expect(content.querySelector('a,button,input,select,textarea,[tabindex]')).toBeNull();

    content.remove();
    await advance(0);
    expect(trigger.hasAttribute('aria-describedby')).toBe(false);
  });
});
