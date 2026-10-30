import { afterEach, describe, expect, it, vi } from 'vitest';
import { styleContains } from '../../test-utils/style';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { dropdownContent, dropdownItem, dropdownRoot, dropdownTrigger } from '../src/dropdown';

AdaptToWebComponent(dropdownRoot as any);
AdaptToWebComponent(dropdownTrigger as any);
AdaptToWebComponent(dropdownContent as any);
AdaptToWebComponent(dropdownItem as any);

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function settle() {
  await vi.advanceTimersByTimeAsync(0);
  await flush();
}

function createDropdown(triggerProps: Record<string, unknown> = {}) {
  const root = document.createElement('shadcn-dropdown-root') as any;
  const trigger = document.createElement('shadcn-dropdown-trigger') as any;
  const content = document.createElement('shadcn-dropdown-content') as any;
  const item = document.createElement('shadcn-dropdown-item') as any;
  const destructive = document.createElement('shadcn-dropdown-item') as any;
  trigger.textContent = 'Actions';
  setElementProps(trigger, triggerProps);
  item.textContent = 'Profile';
  destructive.textContent = 'Delete';
  setElementProps(item, { value: 'profile', textValue: 'Profile' });
  setElementProps(destructive, {
    value: 'delete',
    textValue: 'Delete',
    variant: 'destructive',
  });
  content.append(item, destructive);
  root.append(trigger, content);
  document.body.appendChild(root);
  return { root, trigger, content, item, destructive };
}

afterEach(async () => {
  document.body.replaceChildren();
  await flush();
  vi.useRealTimers();
});

describe('prototypes/shadcn: dropdown-menu', () => {
  it('composes official-style Content and Item tokens over Base behavior', async () => {
    vi.useFakeTimers();
    const { root, trigger, content, item, destructive } = createDropdown();
    await flush();

    expect(styleContains(trigger, 'rounded-lg')).toBe(true);
    expect(trigger.querySelector('svg')).toBeNull();
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);
    expect(styleContains(item, 'rounded-sm')).toBe(true);
    expect(styleContains(destructive, 'text-destructive')).toBe(true);

    trigger.click();
    await settle();
    expect(root.getExposes().open.get()).toBe(true);
    expect(content.parentElement).toBe(document.body);
    expect(styleContains(content, 'rounded-lg')).toBe(true);
    expect(styleContains(content, 'bg-popover')).toBe(true);
    expect(styleContains(content, 'ring-foreground/10')).toBe(true);
    expect(styleContains(content, 'duration-100')).toBe(true);
    expect(content.getExposes().transitionState.get()).toBe('entering');
    // The enter animation is keyed on the inherited `open` fact, which the Web
    // host exposes as `data-open`; the rule therefore lowers to the
    // `data-[open]:`-prefixed token rather than a runtime-applied bare token.
    expect(styleContains(content, 'data-[open]:animate-in')).toBe(true);
    expect(document.activeElement).toBe(item);
  });

  it('retains the leaving portaled surface for the configured shadcn transition', async () => {
    vi.useFakeTimers();
    const { root, trigger, content, item } = createDropdown();
    await flush();
    trigger.click();
    await settle();
    content.getExposes().controls.complete();
    await flush();

    item.click();
    await settle();
    expect(root.getExposes().open.get()).toBe(false);
    expect(content.getExposes().transitionState.get()).toBe('leaving');
    expect(content.hasAttribute('data-pui-view-detached')).toBe(false);
    expect(styleContains(content, 'animate-out')).toBe(true);

    await vi.advanceTimersByTimeAsync(100);
    await flush();
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);
  });

  it('keeps the legacy indicator extension opt-in', async () => {
    vi.useFakeTimers();
    const { trigger } = createDropdown({ indicator: true, indicatorIcon: 'chevron-down' });
    await flush();
    const indicator = trigger.querySelector('svg');
    expect(indicator?.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(indicator?.querySelector('path')?.getAttribute('d')).toBe('m6 9 6 6 6-6');
  });
});
