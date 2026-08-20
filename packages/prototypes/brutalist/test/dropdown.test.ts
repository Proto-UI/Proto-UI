import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WebComponentAdapterElement } from '@proto.ui/adapter-web-component';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { styleContains } from '../../test-utils/style';
import { dropdownContent, dropdownItem, dropdownRoot, dropdownTrigger } from '../src/dropdown';

type DropdownRootElement = WebComponentAdapterElement<typeof dropdownRoot>;
type DropdownTriggerElement = WebComponentAdapterElement<typeof dropdownTrigger>;
type DropdownContentElement = WebComponentAdapterElement<typeof dropdownContent>;
type DropdownItemElement = WebComponentAdapterElement<typeof dropdownItem> & {
  setProps(next: Record<string, unknown>): void;
};

AdaptToWebComponent(dropdownRoot);
AdaptToWebComponent(dropdownTrigger);
AdaptToWebComponent(dropdownContent);
AdaptToWebComponent(dropdownItem);

async function flush(): Promise<void> {
  for (let index = 0; index < 4; index += 1) await Promise.resolve();
}

async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
  await flush();
}

function createDropdown(options?: {
  root?: Record<string, unknown>;
  trigger?: Record<string, unknown>;
  content?: Record<string, unknown>;
  items?: Array<Record<string, unknown>>;
}) {
  const root = document.createElement(dropdownRoot.name) as DropdownRootElement;
  const trigger = document.createElement(dropdownTrigger.name) as DropdownTriggerElement;
  const content = document.createElement(dropdownContent.name) as DropdownContentElement;
  const itemProps = options?.items ?? [
    { value: 'alpha', textValue: 'Alpha' },
    { value: 'beta', textValue: 'Beta' },
  ];
  const items = itemProps.map((props) => {
    const item = document.createElement(dropdownItem.name) as DropdownItemElement;
    setElementProps(item, props);
    item.textContent = String(props.textValue ?? props.value ?? 'Item');
    content.appendChild(item);
    return item;
  });
  setElementProps(root, options?.root ?? {});
  setElementProps(trigger, options?.trigger ?? {});
  setElementProps(
    content,
    options?.content ?? { side: 'top', align: 'start', avoidCollisions: false }
  );
  trigger.textContent = 'Actions';
  root.append(trigger, content);
  document.body.appendChild(root);
  return { root, trigger, content, items };
}

afterEach(async () => {
  document.body.replaceChildren();
  await flush();
  vi.useRealTimers();
});

describe('prototypes/brutalist: dropdown menu', () => {
  it('projects the direct Root entry and inherited menu ownership', async () => {
    // T-BRUTALIST-DROPDOWN-MENU-0001-CASE-1
    vi.useFakeTimers();
    const { root, trigger, content, items } = createDropdown();
    await flush();

    expect(dropdownRoot.name).toBe('brutalist-dropdown-root');
    expect(root.getExposes().open.get()).toBe(false);
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);
    expect(
      root
        .getExposes()
        .getCollectionItems()
        .map((item) => item.value)
    ).toEqual(['alpha', 'beta']);

    trigger.click();
    await settle();
    expect(root.getExposes().open.get()).toBe(true);
    expect(content.getAttribute('role')).toBe('menu');
    expect(content.parentElement).toBe(document.body);
    expect(document.activeElement).toBe(items[0]);
    expect(items[0]?.getExposes().active.get()).toBe(true);
  });

  it('renders indicator props and activates Trigger interaction/gating states', async () => {
    // T-BRUTALIST-DROPDOWN-MENU-0001-CASE-2
    vi.useFakeTimers();
    const { root, trigger } = createDropdown({
      trigger: {
        indicator: true,
        indicatorIcon: 'chevrons-up-down',
        indicatorSize: 20,
        indicatorStrokeWidth: 3,
      },
    });
    await flush();

    expect(dropdownTrigger.name).toBe('brutalist-dropdown-trigger');
    expect(trigger.getAttribute('role')).toBe('button');
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    for (const token of [
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
    const indicator = trigger.querySelector('svg');
    expect(indicator?.getAttribute('width')).toBe('20');
    expect(indicator?.getAttribute('height')).toBe('20');
    expect(indicator?.getAttribute('stroke-width')).toBe('3');
    expect(
      Array.from(indicator?.querySelectorAll('path') ?? []).map((path) => path.getAttribute('d'))
    ).toEqual(['m7 15 5 5 5-5', 'm7 9 5-5 5 5']);

    trigger.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    await flush();
    expect(trigger.getExposes().hovered.get()).toBe(true);
    expect(styleContains(trigger, 'data-[hovered]:-translate-x-px')).toBe(true);
    trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await flush();
    expect(trigger.getExposes().pressed.get()).toBe(true);
    expect(styleContains(trigger, 'data-[pressed]:shadow-none')).toBe(true);
    trigger.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    trigger.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    await flush();
    expect(trigger.getExposes().focusVisible.get()).toBe(true);
    expect(styleContains(trigger, 'data-[focus-visible]:ring-2')).toBe(true);
    expect(styleContains(trigger, 'data-[focus-visible]:ring-offset-background')).toBe(true);

    setElementProps(trigger, { disabled: true });
    await flush();
    trigger.click();
    await settle();
    expect(trigger.getExposes().disabled.get()).toBe(true);
    expect(trigger.getAttribute('aria-disabled')).toBe('true');
    expect(root.getExposes().open.get()).toBe(false);
    expect(styleContains(trigger, 'data-[disabled]:pointer-events-none')).toBe(true);
    expect(styleContains(trigger, 'data-[disabled]:opacity-50')).toBe(true);
  });

  it('retains the hard-shadowed panel for 150ms enter and 100ms leave', async () => {
    // T-BRUTALIST-DROPDOWN-MENU-0001-CASE-3
    vi.useFakeTimers();
    const { root, trigger, content } = createDropdown();
    await flush();
    expect(content.getExposes().transitionState.get()).toBe('closed');
    expect(content.getExposes().isPresent.get()).toBe(false);

    trigger.click();
    await settle();
    expect(content.getExposes().transitionState.get()).toBe('entering');
    expect(content.getExposes().isPresent.get()).toBe(true);
    expect(content.parentElement).toBe(document.body);
    expect(content.dataset.side).toBe('top');
    for (const token of [
      'min-w-32',
      'overflow-y-auto',
      'p-1',
      'duration-150',
      'rounded-none',
      'border-2',
      'border-black',
      'bg-secondary-background',
      'text-foreground',
      'shadow-[3px_3px_0_0_#000]',
      'animate-in',
      'fade-in-0',
      'zoom-in-95',
      'slide-in-from-bottom-2',
    ]) {
      expect(styleContains(content, token)).toBe(true);
    }
    await vi.advanceTimersByTimeAsync(149);
    await flush();
    expect(content.getExposes().transitionState.get()).toBe('entering');
    await vi.advanceTimersByTimeAsync(1);
    await flush();
    expect(content.getExposes().transitionState.get()).toBe('entered');

    root.getExposes().close('test.close');
    await flush();
    expect(content.getExposes().transitionState.get()).toBe('leaving');
    expect(content.hasAttribute('data-pui-view-detached')).toBe(false);
    expect(styleContains(content, 'animate-out')).toBe(true);
    expect(styleContains(content, 'fade-out-0')).toBe(true);
    expect(styleContains(content, 'zoom-out-95')).toBe(true);
    await vi.advanceTimersByTimeAsync(99);
    await flush();
    expect(content.getExposes().transitionState.get()).toBe('leaving');
    await vi.advanceTimersByTimeAsync(1);
    await flush();
    expect(content.getExposes().transitionState.get()).toBe('closed');
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);
  });

  it('restores default Item props and applies the main pair to active state', async () => {
    // T-BRUTALIST-DROPDOWN-MENU-0001-CASE-4
    vi.useFakeTimers();
    const { trigger, items } = createDropdown({
      items: [
        { value: 'alpha', textValue: 'Alpha' },
        { value: 'beta', textValue: 'Beta', inset: true },
      ],
    });
    await flush();
    const item = items[1];
    if (!item) throw new Error('Expected the second Dropdown item.');
    expect(dropdownItem.name).toBe('brutalist-dropdown-item');
    expect(styleContains(item, 'pl-8')).toBe(true);
    item.setProps({ value: 'beta', textValue: 'Beta' });
    await flush();
    expect(item.hasAttribute('data-inset')).toBe(false);
    expect(styleContains(item, 'pl-8')).toBe(false);

    trigger.click();
    await settle();
    item.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    await flush();
    expect(item.getExposes().active.get()).toBe(true);
    expect(styleContains(item, 'bg-main')).toBe(true);
    expect(styleContains(item, 'text-main-foreground')).toBe(true);
  });

  it('keeps the destructive pair when its Item is active', async () => {
    // T-BRUTALIST-DROPDOWN-MENU-0001-CASE-5
    vi.useFakeTimers();
    const { trigger, items } = createDropdown({
      items: [{ value: 'delete', textValue: 'Delete', variant: 'destructive' }],
    });
    await flush();
    const item = items[0];
    if (!item) throw new Error('Expected the destructive Dropdown item.');
    expect(styleContains(item, 'bg-secondary-background')).toBe(true);
    // The resting row reads with the ink, not the fill; `destructive` on paper
    // was 1.41:1.
    expect(styleContains(item, 'text-destructive-ink')).toBe(true);

    trigger.click();
    await settle();
    item.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    await flush();
    expect(item.getExposes().active.get()).toBe(true);
    expect(styleContains(item, 'bg-destructive')).toBe(true);
    expect(styleContains(item, 'text-destructive-foreground')).toBe(true);
    expect(styleContains(item, 'bg-main')).toBe(false);
  });

  it('keeps an explicit disabled pair and suppresses Item selection', async () => {
    // T-BRUTALIST-DROPDOWN-MENU-0001-CASE-6
    vi.useFakeTimers();
    const { root, trigger, items } = createDropdown({
      items: [{ value: 'locked', textValue: 'Locked', disabled: true }],
    });
    const selections: unknown[] = [];
    items[0]?.addEventListener('select', (event: Event) =>
      selections.push((event as CustomEvent).detail)
    );
    await flush();
    const item = items[0];
    if (!item) throw new Error('Expected the disabled Dropdown item.');

    trigger.click();
    await settle();
    expect(root.getExposes().open.get()).toBe(true);
    expect(item.getExposes().disabled.get()).toBe(true);
    expect(item.getAttribute('aria-disabled')).toBe('true');
    item.click();
    await settle();
    expect(selections).toEqual([]);
    expect(root.getExposes().open.get()).toBe(true);
    expect(styleContains(item, 'data-[disabled]:bg-secondary-background')).toBe(true);
    expect(styleContains(item, 'data-[disabled]:text-muted-foreground')).toBe(true);
    expect(styleContains(item, 'data-[disabled]:pointer-events-none')).toBe(true);
    expect(styleContains(item, 'data-[disabled]:opacity-50')).toBe(false);
  });
});
