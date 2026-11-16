import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  renderProtoStyleTokenCss,
  renderProtoShadowStyleTokenCss,
} from '../../../cli/src/services/proto-style-css';
import { styleContains } from '../../test-utils/style';
import { definePrototype } from '@proto.ui/core';
import { useTooltipTrigger } from '@proto.ui/prototypes-base/tooltip';
import shadcnButton from '../src/button';
import type { ShadcnButtonExposes, ShadcnButtonProps } from '../src/button/types';
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
    const surface = [
      'z-50',
      'inline-flex',
      'w-fit',
      'max-w-80',
      'items-center',
      'gap-1.5',
      'rounded-md',
      'bg-foreground',
      'px-3',
      'py-1.5',
      'text-xs',
      'text-background',
    ];
    for (const token of surface) expect(styleContains(content, token), token).toBe(true);
    // The exposed open State lowers entry paint to data-[open] CSS selectors.
    // Check both the emitted recipe and its current activation fact.
    expect(content.getExposes().open.get()).toBe(true);
    expect(content.hasAttribute('data-open')).toBe(true);
    for (const token of [
      'data-[open]:animate-in',
      'data-[open]:fade-in-0',
      'data-[open]:zoom-in-95',
      'slide-in-from-bottom-2',
    ]) {
      expect(styleContains(content, token), token).toBe(true);
    }
    for (const token of [
      'overflow-hidden',
      'border',
      'bg-popover',
      'text-popover-foreground',
      'shadow-md',
      'max-w-xs',
    ]) {
      expect(styleContains(content, token), token).toBe(false);
    }
    // Feed actual opened renderer output through both existing physical CSS paths.
    const emitted = (content.getAttribute('data-pui-style') ?? '').split(/\s+/).filter(Boolean);
    for (const render of [renderProtoStyleTokenCss, renderProtoShadowStyleTokenCss]) {
      const css = render(emitted);
      expect(css).not.toContain('Unsupported Proto UI style tokens');
      for (const declaration of [
        'z-index: 50;',
        'display: inline-flex;',
        'width: fit-content;',
        'max-width: 20rem;',
        'align-items: center;',
        'gap: 0.375rem;',
        'background-color: var(--pui-foreground);',
        'color: var(--pui-background);',
        'padding-inline: 0.75rem;',
        'padding-block: 0.375rem;',
        'font-size: 0.75rem;',
      ])
        expect(css, declaration).toContain(declaration);
      expect(css).not.toContain('overflow: hidden;');
      expect(css).not.toContain('border-width: 1px;');
      expect(css).not.toContain('background-color: var(--pui-popover);');
      expect(css).not.toContain('box-shadow:');
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
    expect(first.content.getExposes().open.get()).toBe(false);
    expect(first.content.hasAttribute('data-open')).toBe(false);
    expect(first.content.getExposes().transitionState.get()).toBe('leaving');
    for (const token of ['animate-out', 'fade-out-0', 'zoom-out-95']) {
      expect(styleContains(first.content, token), token).toBe(true);
    }

    second.trigger.dispatchEvent(new Event('pointerenter'));
    await advance(0);
    expect(second.root.getExposes().open.get()).toBe(true);
    expect(first.root.getExposes().open.get()).toBe(false);
    expect(second.content.getExposes().open.get()).toBe(true);
    expect(second.content.hasAttribute('data-open')).toBe(true);
    expect(second.content.getExposes().transitionState.get()).toBe('entering');
    for (const token of [
      'data-[open]:animate-in',
      'data-[open]:fade-in-0',
      'data-[open]:zoom-in-95',
      'slide-in-from-bottom-2',
    ]) {
      expect(styleContains(second.content, token), token).toBe(true);
    }

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

  it('composes one focus target and owned description on a shadcn Button', async () => {
    vi.useFakeTimers();
    const TooltipButton = AdaptToWebComponent(
      definePrototype<ShadcnButtonProps, ShadcnButtonExposes>({
        name: 'test-shadcn-tooltip-button',
        setup(def) {
          const render = shadcnButton.setup(def);
          useTooltipTrigger();
          return render;
        },
      })
    );
    const root = new TooltipRootElement();
    const button = new TooltipButton();
    const content = new TooltipContentElement();
    setElementProps(root, { openDelay: 0, closeDelay: 0 });
    button.textContent = 'Save';
    content.append(document.createTextNode('Save this document'));
    root.append(button, content);
    document.body.append(root);
    await flush();

    expect(button.getAttribute('role')).toBe('button');
    expect(root.querySelectorAll('[tabindex="0"]')).toHaveLength(1);

    button.focus();
    await advance(0);
    expect(root.getExposes().open.get()).toBe(true);
    expect(button.getAttribute('aria-describedby')).toBe(content.id);

    button.blur();
    await advance(0);
    expect(root.getExposes().open.get()).toBe(false);
    expect(button.hasAttribute('aria-describedby')).toBe(false);

    button.dispatchEvent(new Event('pointerenter'));
    await advance(0);
    expect(root.getExposes().open.get()).toBe(true);
    expect(button.getAttribute('aria-describedby')).toBe(content.id);

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    await advance(0);
    expect(root.getExposes().open.get()).toBe(false);
  });

  it('does not add a second tab stop when the standalone Trigger wraps a focusable control', async () => {
    vi.useFakeTimers();
    const root = new TooltipRootElement();
    const trigger = new TooltipTriggerElement();
    const content = new TooltipContentElement();
    const button = document.createElement('button');
    button.textContent = 'Save';
    trigger.appendChild(button);
    setElementProps(root, { openDelay: 0, closeDelay: 0 });
    root.append(trigger, content);
    document.body.append(root);
    await flush();

    // The trigger defers sequential navigation to the wrapped focusable child.
    expect(trigger.getAttribute('tabindex')).not.toBe('0');
    // The only sequential tab stop is the native button.
    button.focus();
    expect(document.activeElement).toBe(button);

    // The child's focus opens the tooltip through the bubbled focusin path.
    await advance(0);
    expect(root.getExposes().open.get()).toBe(true);

    button.blur();
    await advance(0);
    expect(root.getExposes().open.get()).toBe(false);

    trigger.dispatchEvent(new Event('pointerenter'));
    await advance(0);
    expect(root.getExposes().open.get()).toBe(true);

    trigger.dispatchEvent(new Event('pointerleave'));
    await advance(0);
    expect(root.getExposes().open.get()).toBe(false);
  });

  it('keeps the standalone Trigger focusable when no focusable descendant exists', async () => {
    const { trigger } = appendTooltip(document.body, { defaultOpen: true });
    await flush();
    expect(trigger.getAttribute('tabindex')).toBe('0');
    expect(trigger.getAttribute('role')).toBeNull();
  });
});
