import { afterEach, describe, expect, it, vi } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  asSelectItem,
  selectContent,
  selectItem,
  selectRoot,
  selectTrigger,
  selectValue,
} from '../src/select';

AdaptToWebComponent(selectRoot as any);
AdaptToWebComponent(selectTrigger as any);
AdaptToWebComponent(selectValue as any);
AdaptToWebComponent(selectContent as any);
AdaptToWebComponent(selectItem as any);

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
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
  itemTag?: string;
}) {
  const root = document.createElement('base-select-root') as any;
  const trigger = document.createElement('base-select-trigger') as any;
  const value = document.createElement('base-select-value') as any;
  const content = document.createElement('base-select-content') as any;
  const items = (
    options?.items ?? [
      { value: 'alpha', textValue: 'Alpha' },
      { value: 'beta', textValue: 'Beta' },
      { value: 'gamma', textValue: 'Gamma' },
    ]
  ).map((props) => {
    const item = document.createElement(options?.itemTag ?? 'base-select-item') as any;
    setElementProps(item, props);
    item.textContent = String(props.textValue ?? props.value ?? 'Option');
    content.appendChild(item);
    return item;
  });
  setElementProps(root, options?.root ?? {});
  setElementProps(trigger, options?.trigger ?? {});
  setElementProps(value, options?.value ?? { placeholder: 'Pick one' });
  setElementProps(content, options?.content ?? {});
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

describe('prototypes/base: select', () => {
  it('keeps deprecated A11y borrowed views separate from committed selection', async () => {
    // D-STATE-SEMANTIC-ACCESSORS-DEPRECATION-0001-C; P-BASE-SELECT-ITEM-CONTROLLED.
    // Exercise coexistence while the deprecated accessor is still supported.
    AdaptToWebComponent(
      definePrototype({
        name: 'select-item-compatibility-probe',
        setup(def) {
          asSelectItem();
          const borrowed = def.state.fromAccessibility('selected');
          def.expose.method('writeBorrowedSelected', (value: boolean) => borrowed.set(value));
        },
      })
    );
    vi.useFakeTimers();
    const {
      root,
      items: [item],
    } = createSelect({
      root: { value: 'alpha', open: true },
      itemTag: 'select-item-compatibility-probe',
      items: [{ value: 'beta', textValue: 'Beta' }],
    });
    await settle();
    const selected = () => ({
      value: root.getExposes().value.get(),
      exposed: item.getExposes().selected.get(),
      aria: item.getAttribute('aria-selected'),
    });
    expect(selected()).toEqual({ value: 'alpha', exposed: false, aria: 'false' });
    item.getExposes().writeBorrowedSelected(true);
    await settle();
    expect(selected()).toEqual({ value: 'alpha', exposed: false, aria: 'false' });
    setElementProps(root, { value: 'beta', open: true });
    await settle();
    expect(selected()).toEqual({ value: 'beta', exposed: true, aria: 'true' });
    item.getExposes().writeBorrowedSelected(false);
    await settle();
    expect(selected()).toEqual({ value: 'beta', exposed: true, aria: 'true' });
  });

  it('owns single-selection facts, collection, anatomy, and live selected text', async () => {
    // T-BASE-SELECT-0001-CASE-ROOT-OWNERSHIP
    // T-BASE-SELECT-0001-CASE-SELECTION-TEXT
    // T-BASE-SELECT-VALUE-0001-CASE-CONTEXT-FALLBACK
    vi.useFakeTimers();
    const { root, value, items } = createSelect({ root: { defaultValue: 'beta' } });
    await settle();

    expect(root.getExposes()).toHaveProperty('requestOpen');
    expect(root.getExposes()).toHaveProperty('requestValue');
    expect(root.getExposes().value.get()).toBe('beta');
    expect(root.getExposes().textValue.get()).toBe('Beta');
    expect(value.getExposes().displayValue.get()).toBe('Beta');
    expect(value.textContent).toBe('Beta');
    expect(
      root
        .getExposes()
        .getCollectionItems()
        .map((item: any) => item.value)
    ).toEqual(['alpha', 'beta', 'gamma']);
    expect(items[1].getExposes().selected.get()).toBe(true);

    setElementProps(items[1], { value: 'beta', textValue: 'Beta v2' });
    await flush();
    expect(root.getExposes().value.get()).toBe('beta');
    expect(root.getExposes().textValue.get()).toBe('Beta v2');
    expect(value.textContent).toBe('Beta v2');
  });

  it('emits controlled open and value requests without replacing either owner fact', async () => {
    // T-BASE-SELECT-0001-CASE-REQUESTS
    // T-BASE-SELECT-ITEM-0001-CASE-COMMIT
    vi.useFakeTimers();
    const { root, trigger, items } = createSelect({
      root: { open: false, value: 'alpha' },
    });
    const openRequests: any[] = [];
    const valueRequests: any[] = [];
    root.addEventListener('openChange', (event: Event) =>
      openRequests.push((event as CustomEvent).detail)
    );
    root.addEventListener('valueChange', (event: Event) =>
      valueRequests.push((event as CustomEvent).detail)
    );
    await settle();

    trigger.click();
    await settle();
    expect(root.getExposes().open.get()).toBe(false);
    expect(openRequests.at(-1)).toEqual(
      expect.objectContaining({ open: true, reason: 'trigger.press', focusReason: 'pointer' })
    );

    setElementProps(root, { open: true, value: 'alpha' });
    await settle();
    items[1].click();
    await settle();
    expect(root.getExposes().value.get()).toBe('alpha');
    expect(root.getExposes().open.get()).toBe(true);
    expect(valueRequests.at(-1)).toEqual({ value: 'beta', textValue: 'Beta', reason: 'pointer' });
    expect(openRequests.at(-1)).toEqual(
      expect.objectContaining({ open: false, reason: 'item.select' })
    );
  });

  it('projects combobox, listbox, option, and stable relationship semantics', async () => {
    // T-BASE-SELECT-TRIGGER-0001-CASE-COMMAND-A11Y
    // T-BASE-SELECT-CONTENT-0001-CASE-A11Y-FOCUS
    // T-BASE-SELECT-ITEM-0001-CASE-COLLECTION-A11Y
    vi.useFakeTimers();
    const { trigger, value, content, items } = createSelect({ root: { defaultValue: 'beta' } });
    await settle();

    expect(trigger.getAttribute('role')).toBe('combobox');
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-controls')).toMatch(/^pui-select-\d+-content$/);
    expect(value.getAttribute('data-pui-style')).toContain('pointer-events-none');
    trigger.click();
    await settle();
    expect(content.getAttribute('id')).toBe(trigger.getAttribute('aria-controls'));
    expect(content.getAttribute('role')).toBe('listbox');
    expect(content.getAttribute('aria-orientation')).toBe('vertical');
    expect(items[0].getAttribute('role')).toBe('option');
    expect(items[0].getAttribute('aria-selected')).toBe('false');
    expect(items[1].getAttribute('aria-selected')).toBe('true');
    expect(items[0].getAttribute('aria-disabled')).toBe('false');
  });

  it.each([
    ['Enter', 'beta'],
    [' ', 'beta'],
    ['ArrowDown', 'beta'],
    ['ArrowUp', 'beta'],
  ])('opens from Trigger %j and focuses selected option %s once', async (key, expectedValue) => {
    // T-BASE-SELECT-TRIGGER-0001-CASE-KEYBOARD
    vi.useFakeTimers();
    const { root, trigger, items } = createSelect({ root: { defaultValue: 'beta' } });
    const requests: any[] = [];
    root.addEventListener('openChange', (event: Event) =>
      requests.push((event as CustomEvent).detail)
    );
    await settle();

    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    await settle();
    expect(root.getExposes().open.get()).toBe(true);
    expect(document.activeElement).toBe(items[1]);
    expect(items[1].getExposes().active.get()).toBe(true);
    expect(items[1].getExposes().selected.get()).toBe(true);
    expect(items[1].textContent).toBe(expectedValue === 'beta' ? 'Beta' : expectedValue);
    expect(requests.filter((request) => request.open).length).toBe(1);
  });

  it('uses first or last enabled boundary when no value is selected', async () => {
    // T-BASE-SELECT-TRIGGER-0001-CASE-KEYBOARD
    // T-BASE-SELECT-CONTENT-0001-CASE-KEYBOARD
    vi.useFakeTimers();
    const down = createSelect({ items: [{ value: 'a' }, { value: 'b', disabled: true }] });
    await settle();
    down.trigger.focus();
    down.trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await settle();
    expect(document.activeElement).toBe(down.items[0]);
    expect(down.root.getExposes().value.get()).toBe('');
    down.root.remove();
    await flush();

    const up = createSelect({
      items: [{ value: 'a' }, { value: 'b', disabled: true }, { value: 'c' }],
    });
    await settle();
    up.trigger.focus();
    up.trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    await settle();
    expect(document.activeElement).toBe(up.items[2]);
    expect(up.root.getExposes().value.get()).toBe('');
  });

  it('keeps active navigation separate from selected and skips disabled options', async () => {
    // T-BASE-SELECT-ITEM-0001-CASE-STATE-SEPARATION
    // T-BASE-SELECT-ITEM-0001-CASE-DISABLED
    vi.useFakeTimers();
    const { root, items } = createSelect({
      root: { defaultOpen: true, defaultValue: 'alpha' },
      items: [
        { value: 'alpha', textValue: 'Alpha' },
        { value: 'beta', textValue: 'Beta', disabled: true },
        { value: 'gamma', textValue: 'Gamma' },
      ],
    });
    await settle();
    expect(document.activeElement).toBe(items[0]);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    await flush();
    expect(document.activeElement).toBe(items[2]);
    expect(items[0].getExposes().selected.get()).toBe(true);
    expect(items[0].getExposes().active.get()).toBe(false);
    expect(items[2].getExposes().selected.get()).toBe(false);
    expect(items[2].getExposes().active.get()).toBe(true);
    expect(root.getExposes().value.get()).toBe('alpha');

    items[1].click();
    await flush();
    expect(root.getExposes().value.get()).toBe('alpha');
    expect(root.getExposes().open.get()).toBe(true);
    expect(items[1].getAttribute('aria-disabled')).toBe('true');
  });

  it('clears pointer highlight on leave and resets every transient Item state on close', async () => {
    // T-BASE-SELECT-ITEM-0001-CASE-TRANSIENT-RESET
    // T-BASE-SELECT-CONTENT-0001-CASE-ENTRY-STABILITY
    vi.useFakeTimers();
    const { root, trigger, items } = createSelect({
      root: { defaultOpen: true, defaultValue: 'alpha' },
    });
    await settle();
    expect(document.activeElement).toBe(items[0]);

    items[1].dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    await flush();
    expect(items[1].getExposes().hovered.get()).toBe(true);
    expect(items[1].getExposes().active.get()).toBe(true);
    expect(root.getExposes().value.get()).toBe('alpha');

    items[1].dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
    await flush();
    expect(items[1].getExposes().hovered.get()).toBe(false);
    expect(items[1].getExposes().active.get()).toBe(false);
    expect(items[0].getExposes().active.get()).toBe(true);

    items[1].focus();
    await flush();
    expect(items[1].getExposes().active.get()).toBe(true);
    trigger.focus();
    await flush();
    expect(items[1].getExposes().focused.get()).toBe(false);
    expect(items[1].getExposes().active.get()).toBe(false);

    items[1].dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    items[1].click();
    await settle();
    expect(root.getExposes().open.get()).toBe(false);
    expect(document.activeElement).toBe(trigger);
    for (const item of items) {
      expect(item.getExposes().hovered.get()).toBe(false);
      expect(item.getExposes().focused.get()).toBe(false);
      expect(item.getExposes().active.get()).toBe(false);
    }

    trigger.click();
    await settle();
    expect(document.activeElement).toBe(items[1]);
    expect(items.filter((item) => item.getExposes().focused.get())).toEqual([items[1]]);
    expect(items.filter((item) => item.getExposes().active.get())).toEqual([items[1]]);
  });

  it('supports Home, End, and printable typeahead through asFocusRoving', async () => {
    // T-BASE-SELECT-CONTENT-0001-CASE-KEYBOARD
    vi.useFakeTimers();
    const { items } = createSelect({ root: { defaultOpen: true } });
    await settle();
    expect(document.activeElement).toBe(items[0]);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    await flush();
    expect(document.activeElement).toBe(items[2]);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    await flush();
    expect(document.activeElement).toBe(items[0]);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    await flush();
    expect(document.activeElement).toBe(items[2]);
  });

  it('commits with keyboard, refreshes Value, closes, and restores Trigger focus', async () => {
    // T-BASE-SELECT-ITEM-0001-CASE-COMMIT
    // T-BASE-SELECT-CONTENT-0001-CASE-DISMISS
    vi.useFakeTimers();
    const { root, trigger, value, items } = createSelect();
    await settle();
    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await settle();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    await flush();
    expect(document.activeElement).toBe(items[1]);

    items[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle();
    expect(root.getExposes().value.get()).toBe('beta');
    expect(value.textContent).toBe('Beta');
    expect(root.getExposes().open.get()).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('Escape cancels navigation, closes, and restores Trigger focus', async () => {
    // T-BASE-SELECT-0001-CASE-SELECTION-TEXT
    // T-BASE-SELECT-CONTENT-0001-CASE-DISMISS
    vi.useFakeTimers();
    const { root, trigger, items } = createSelect({ root: { defaultValue: 'alpha' } });
    await settle();
    trigger.click();
    await settle();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    await flush();
    expect(document.activeElement).toBe(items[1]);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await settle();
    expect(root.getExposes().open.get()).toBe(false);
    expect(root.getExposes().value.get()).toBe('alpha');
    expect(document.activeElement).toBe(trigger);
  });

  it('Tab and outside press close without accidental selection', async () => {
    // T-BASE-SELECT-CONTENT-0001-CASE-DISMISS
    vi.useFakeTimers();
    const tabSelect = createSelect({ root: { defaultOpen: true, defaultValue: 'alpha' } });
    await settle();
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    window.dispatchEvent(tabEvent);
    await settle();
    expect(tabSelect.root.getExposes().open.get()).toBe(false);
    expect(tabSelect.root.getExposes().value.get()).toBe('alpha');
    expect(tabEvent.defaultPrevented).toBe(false);
    tabSelect.root.remove();
    await flush();

    const outsideSelect = createSelect({ root: { defaultOpen: true } });
    await settle();
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await settle();
    expect(outsideSelect.root.getExposes().open.get()).toBe(false);
    expect(outsideSelect.root.getExposes().value.get()).toBe('');
  });

  it.each([false, true])(
    'Tab from Trigger dismisses before deferred entry (shift=%s)',
    async (shiftKey) => {
      vi.useFakeTimers();
      const { root, trigger, items } = createSelect({ root: { defaultValue: 'alpha' } });
      await settle();
      trigger.focus();
      trigger.click();
      await flush(); // Deliberately do not run the deferred open-focus timer.
      expect(root.getExposes().open.get()).toBe(true);
      expect(document.activeElement).toBe(trigger);
      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey,
        bubbles: true,
        cancelable: true,
      });
      trigger.dispatchEvent(event);
      await flush();
      expect(root.getExposes().open.get()).toBe(false);
      expect(root.getExposes().value.get()).toBe('alpha');
      expect(event.defaultPrevented).toBe(false);
      await settle();
      expect(items.some((item) => item === document.activeElement)).toBe(false);
    }
  );

  it.each([false, true])(
    'deferred Tab honors controlled rejection and does not dismiss another domain (shift=%s)',
    async (shiftKey) => {
      vi.useFakeTimers();
      const a = createSelect({ root: { open: false, value: 'alpha' } });
      const b = createSelect({ root: { open: false, value: 'beta' } });
      await settle();
      const requestsA: any[] = [];
      const requestsB: any[] = [];
      a.root.addEventListener('openChange', (event: any) => requestsA.push(event.detail));
      b.root.addEventListener('openChange', (event: any) => requestsB.push(event.detail));
      setElementProps(a.root, { open: true, value: 'alpha' });
      setElementProps(b.root, { open: true, value: 'beta' });
      await flush();
      a.trigger.focus();
      const tab = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey,
        bubbles: true,
        cancelable: true,
      });
      a.trigger.dispatchEvent(tab);
      expect(tab.defaultPrevented).toBe(false);
      await flush();
      expect(requestsA).toEqual([expect.objectContaining({ open: false, reason: 'tab' })]);
      expect(requestsB).toEqual([]);
      expect(a.root.getExposes().open.get()).toBe(true);
      expect(b.root.getExposes().open.get()).toBe(true);
      expect(a.root.getExposes().value.get()).toBe('alpha');
      const outside = document.createElement('button');
      document.body.append(outside);
      outside.focus();
      // A late Item publication must not revive the cancelled entry of this open epoch.
      const later = document.createElement('base-select-item');
      setElementProps(later, { value: 'later', textValue: 'Later' });
      a.content.appendChild(later);
      await flush();
      outside.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      await flush();
      expect(requestsA).toHaveLength(1);
      expect(requestsB).toHaveLength(0);
      b.root.remove();
      await settle();
      await settle();
      await settle();
      expect(document.activeElement).toBe(outside);
      expect(a.root.getExposes().open.get()).toBe(true);
      expect(a.root.getExposes().value.get()).toBe('alpha');

      // Cancelling this old entry must not disable a subsequent accepted open epoch.
      setElementProps(a.root, { open: false, value: 'alpha' });
      await settle();
      setElementProps(a.root, { open: true, value: 'alpha' });
      await settle();
      await settle();
      expect(document.activeElement).toBe(a.items[0]);
    }
  );

  it('uses Transition as Overlay presence and applies anchored positioning props', async () => {
    // T-BASE-SELECT-CONTENT-0001-CASE-PRESENCE-POSITION
    vi.useFakeTimers();
    const { trigger, content } = createSelect({
      content: { side: 'top', align: 'end', sideOffset: 12, alignOffset: 3 },
    });
    await settle();
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);

    trigger.click();
    await settle();
    expect(content.hasAttribute('data-pui-view-detached')).toBe(false);
    expect(content.getExposes().transitionState.get()).toBe('entered');
    expect(content.style.position).toBe('fixed');
    expect(content.dataset.side).toBe('top');
    expect(content.dataset.align).toBe('end');

    trigger.click();
    await settle();
    expect(content.getExposes().transitionState.get()).toBe('closed');
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);
  });

  it('refreshes placeholder and raw-value fallback through the Value display state', async () => {
    // T-BASE-SELECT-VALUE-0001-CASE-RENDER-EXPOSE
    // T-BASE-SELECT-VALUE-0001-CASE-BOUNDARY
    vi.useFakeTimers();
    const { root, value } = createSelect({
      root: { value: 'missing' },
      value: { placeholder: 'Initial placeholder' },
      items: [],
    });
    await settle();
    expect(value.getExposes()).toEqual(
      expect.objectContaining({
        displayValue: expect.objectContaining({ get: expect.any(Function) }),
      })
    );
    expect(value.getExposes().displayValue.get()).toBe('missing');
    expect(value.textContent).toBe('missing');

    setElementProps(root, { value: '' });
    await flush();
    expect(value.textContent).toBe('Initial placeholder');
    setElementProps(value, { placeholder: 'Updated placeholder' });
    await flush();
    expect(value.getExposes().displayValue.get()).toBe('Updated placeholder');
    expect(value.textContent).toBe('Updated placeholder');
    expect(value.getExposes()).not.toHaveProperty('focusSelf');
    expect(value.getExposes()).not.toHaveProperty('click');
  });

  it('suppresses Trigger and Item behavior under local or Root disabled state', async () => {
    // T-BASE-SELECT-TRIGGER-0001-CASE-DISABLED
    // T-BASE-SELECT-ITEM-0001-CASE-DISABLED
    vi.useFakeTimers();
    const local = createSelect({ trigger: { disabled: true } });
    await settle();
    local.trigger.click();
    await settle();
    expect(local.root.getExposes().open.get()).toBe(false);
    expect(local.trigger.getAttribute('aria-disabled')).toBe('true');
    expect(local.trigger.getAttribute('tabindex')).not.toBe('0');
    local.root.remove();
    await flush();

    const rootDisabled = createSelect({ root: { disabled: true, defaultOpen: true } });
    await settle();
    rootDisabled.items[0].click();
    await settle();
    expect(rootDisabled.root.getExposes().value.get()).toBe('');
    expect(rootDisabled.root.getExposes().open.get()).toBe(true);
    expect(rootDisabled.items[0].getAttribute('aria-disabled')).toBe('true');
  });
});
