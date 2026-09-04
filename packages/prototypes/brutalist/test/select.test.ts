import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WebComponentAdapterElement } from '@proto.ui/adapter-web-component';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { styleContains } from '../../test-utils/style';
import { selectContent, selectItem, selectRoot, selectTrigger, selectValue } from '../src/select';

type SelectRootElement = WebComponentAdapterElement<typeof selectRoot>;
type SelectTriggerElement = WebComponentAdapterElement<typeof selectTrigger> & {
  setProps(next: Record<string, unknown>): void;
};
type SelectValueElement = WebComponentAdapterElement<typeof selectValue>;
type SelectContentElement = WebComponentAdapterElement<typeof selectContent>;
type SelectItemElement = WebComponentAdapterElement<typeof selectItem>;

AdaptToWebComponent(selectRoot);
AdaptToWebComponent(selectTrigger);
AdaptToWebComponent(selectValue);
AdaptToWebComponent(selectContent);
AdaptToWebComponent(selectItem);

async function flush(): Promise<void> {
  for (let index = 0; index < 4; index += 1) await Promise.resolve();
}

async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
  await flush();
}

function createSelect(options?: {
  root?: Record<string, unknown>;
  trigger?: Record<string, unknown>;
  value?: Record<string, unknown>;
  content?: Record<string, unknown>;
  items?: Array<Record<string, unknown>>;
}) {
  const root = document.createElement(selectRoot.name) as SelectRootElement;
  const trigger = document.createElement(selectTrigger.name) as SelectTriggerElement;
  const value = document.createElement(selectValue.name) as SelectValueElement;
  const content = document.createElement(selectContent.name) as SelectContentElement;
  const itemProps = options?.items ?? [
    { value: 'alpha', textValue: 'Alpha' },
    { value: 'beta', textValue: 'Beta' },
  ];
  const items = itemProps.map((props) => {
    const item = document.createElement(selectItem.name) as SelectItemElement;
    setElementProps(item, props);
    item.textContent = String(props.textValue ?? props.value ?? 'Option');
    content.appendChild(item);
    return item;
  });
  setElementProps(root, options?.root ?? {});
  setElementProps(trigger, options?.trigger ?? {});
  setElementProps(value, options?.value ?? {});
  setElementProps(
    content,
    options?.content ?? { side: 'right', align: 'start', avoidCollisions: false }
  );
  trigger.appendChild(value);
  root.append(trigger, content);
  document.body.appendChild(root);
  return { root, trigger, value, content, items };
}

afterEach(async () => {
  document.body.replaceChildren();
  await flush();
  vi.useRealTimers();
});

describe('prototypes/brutalist: select', () => {
  it('projects five direct entries with inherited value and combobox ownership', async () => {
    // T-BRUTALIST-SELECT-0001-CASE-1
    vi.useFakeTimers();
    const { root, trigger, value, content } = createSelect({
      root: { defaultValue: 'alpha' },
    });
    await settle();

    expect(selectRoot.name).toBe('brutalist-select-root');
    expect(selectTrigger.name).toBe('brutalist-select-trigger');
    expect(selectValue.name).toBe('brutalist-select-value');
    expect(selectContent.name).toBe('brutalist-select-content');
    expect(selectItem.name).toBe('brutalist-select-item');
    expect(root.getExposes().value.get()).toBe('alpha');
    expect(root.getExposes().textValue.get()).toBe('Alpha');
    expect(value.getExposes().displayValue.get()).toBe('Alpha');
    expect(value.textContent).toBe('Alpha');
    expect(trigger.getAttribute('role')).toBe('combobox');
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-controls')).toMatch(/^pui-select-\d+-content$/);
    trigger.click();
    await settle();
    expect(content.id).toBe(trigger.getAttribute('aria-controls'));
  });

  it('maps Trigger sizes and restores default after prop removal', async () => {
    // T-BRUTALIST-SELECT-0001-CASE-2
    const { trigger } = createSelect();
    await flush();
    expect(styleContains(trigger, 'h-9')).toBe(true);
    expect(styleContains(trigger, 'h-8')).toBe(false);

    trigger.setProps({ size: 'sm' });
    await flush();
    expect(styleContains(trigger, 'h-8')).toBe(true);
    expect(styleContains(trigger, 'h-9')).toBe(false);

    trigger.setProps({});
    await flush();
    expect(styleContains(trigger, 'h-9')).toBe(true);
    expect(styleContains(trigger, 'h-8')).toBe(false);
  });

  it('renders inherited placeholder text, muted state, and trailing chevron', async () => {
    // T-BRUTALIST-SELECT-0001-CASE-3
    const { trigger, value } = createSelect({
      value: { placeholder: 'Pick one' },
      items: [],
    });
    await flush();

    expect(trigger.getExposes().placeholder.get()).toBe(true);
    expect(trigger.hasAttribute('data-placeholder')).toBe(true);
    expect(styleContains(trigger, 'data-[placeholder]:text-muted-foreground')).toBe(true);
    expect(value.getExposes().displayValue.get()).toBe('Pick one');
    expect(value.textContent).toBe('Pick one');
    const chevron = trigger.querySelector('svg');
    expect(chevron?.getAttribute('width')).toBe('16');
    expect(chevron?.getAttribute('height')).toBe('16');
    expect(chevron?.querySelector('path')?.getAttribute('d')).toBe('m6 9 6 6 6-6');
  });

  it('activates Trigger interaction states while preserving square panel grammar', async () => {
    // T-BRUTALIST-SELECT-0001-CASE-4
    vi.useFakeTimers();
    const { root, trigger } = createSelect();
    await flush();

    for (const token of [
      'rounded-none',
      'border-2',
      'border-black',
      'bg-secondary-background',
      'px-3',
      'py-2',
      'text-sm',
      'shadow-[3px_3px_0_0_#000]',
    ]) {
      expect(styleContains(trigger, token)).toBe(true);
    }

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
    const matchesSpy = vi
      .spyOn(trigger, 'matches')
      .mockImplementation((selector: string) => selector === ':focus-visible');
    trigger.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    await flush();
    expect(trigger.getExposes().focusVisible.get()).toBe(true);
    expect(styleContains(trigger, 'data-[focus-visible]:ring-2')).toBe(true);
    expect(styleContains(trigger, 'data-[focus-visible]:ring-offset-background')).toBe(true);

    trigger.setProps({ disabled: true });
    await flush();
    trigger.click();
    await settle();
    expect(trigger.getExposes().disabled.get()).toBe(true);
    expect(root.getExposes().open.get()).toBe(false);
    expect(styleContains(trigger, 'data-[disabled]:pointer-events-none')).toBe(true);
    expect(styleContains(trigger, 'data-[disabled]:opacity-50')).toBe(true);
  });

  it('renders inherited displayValue precedence and null for an empty display', async () => {
    // T-BRUTALIST-SELECT-0001-CASE-5
    vi.useFakeTimers();
    const selected = createSelect({ root: { defaultValue: 'alpha' } });
    await settle();
    expect(selected.value.getExposes().displayValue.get()).toBe('Alpha');
    expect(selected.value.textContent).toBe('Alpha');
    selected.root.remove();
    await flush();

    const empty = createSelect({ items: [] });
    await flush();
    expect(empty.value.getExposes().displayValue.get()).toBe('');
    expect(empty.value.textContent).toBe('');
    expect(empty.value.childNodes).toHaveLength(0);
  });

  it('retains the anchored panel for 150ms enter and 100ms leave', async () => {
    // T-BRUTALIST-SELECT-0001-CASE-6
    vi.useFakeTimers();
    const { root, trigger, content, items } = createSelect();
    await flush();
    expect(content.getExposes().transitionState.get()).toBe('closed');
    expect(content.getExposes().isPresent.get()).toBe(false);

    trigger.click();
    await settle();
    expect(root.getExposes().open.get()).toBe(true);
    expect(content.getExposes().transitionState.get()).toBe('entering');
    expect(content.getExposes().isPresent.get()).toBe(true);
    expect(content.parentElement).toBe(document.body);
    expect(content.style.position).toBe('fixed');
    expect(content.dataset.side).toBe('right');
    for (const token of [
      'w-[var(--proto-ui-anchor-width)]',
      'min-w-[var(--proto-ui-anchor-width)]',
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
      'slide-in-from-left-2',
    ]) {
      expect(styleContains(content, token)).toBe(true);
    }
    await vi.advanceTimersByTimeAsync(149);
    await flush();
    expect(content.getExposes().transitionState.get()).toBe('entering');
    await vi.advanceTimersByTimeAsync(1);
    await flush();
    expect(content.getExposes().transitionState.get()).toBe('entered');

    items[0]?.click();
    await settle();
    expect(root.getExposes().open.get()).toBe(false);
    expect(content.getExposes().transitionState.get()).toBe('leaving');
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

  it('migrates selected pair and check indicator through real Item selection', async () => {
    // T-BRUTALIST-SELECT-0001-CASE-7
    vi.useFakeTimers();
    const { root, trigger, value, items } = createSelect({ root: { defaultValue: 'alpha' } });
    await settle();
    const alpha = items[0];
    const beta = items[1];
    if (!alpha || !beta) throw new Error('Expected two Select items.');

    expect(alpha.getExposes().selected.get()).toBe(true);
    expect(alpha.getAttribute('aria-selected')).toBe('true');
    expect(alpha.hasAttribute('data-selected')).toBe(true);
    expect(styleContains(alpha, 'data-[selected]:bg-main')).toBe(true);
    expect(styleContains(alpha, 'data-[selected]:text-main-foreground')).toBe(true);
    expect(alpha.querySelector('svg')?.querySelector('path')?.getAttribute('d')).toBe(
      'm20 6-11 11-5-5'
    );
    expect(beta.querySelector('svg')).toBeNull();
    for (const token of ['rounded-none', 'w-full', 'font-mono', 'text-sm', 'justify-between']) {
      expect(styleContains(alpha, token)).toBe(true);
    }

    trigger.click();
    await settle();
    beta.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    await flush();
    expect(beta.getExposes().active.get()).toBe(true);
    expect(styleContains(beta, 'bg-main')).toBe(true);
    expect(styleContains(beta, 'text-main-foreground')).toBe(true);
    beta.click();
    await settle();
    expect(root.getExposes().value.get()).toBe('beta');
    expect(value.textContent).toBe('Beta');
    expect(alpha.getExposes().selected.get()).toBe(false);
    expect(beta.getExposes().selected.get()).toBe(true);
    expect(alpha.querySelector('svg')).toBeNull();
    expect(beta.querySelector('svg')?.querySelector('path')?.getAttribute('d')).toBe(
      'm20 6-11 11-5-5'
    );
  });
});
