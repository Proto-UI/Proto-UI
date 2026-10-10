import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as bootstrap from '../../bootstrap-2-3-2/src/select';
import * as glass from '../../liquid-glass/src/select';
import { styleContains } from '../style';
const families = [
  ['bootstrap-2-3-2', bootstrap],
  ['liquid-glass', glass],
] as const;
for (const [family, projection] of families) {
  const { selectContent, selectItem, selectRoot, selectTrigger, selectValue } = projection;

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
  }) {
    const root = document.createElement(`${family}-select-root`) as any;
    const trigger = document.createElement(`${family}-select-trigger`) as any;
    const value = document.createElement(`${family}-select-value`) as any;
    const content = document.createElement(`${family}-select-content`) as any;
    const items = (
      options?.items ?? [
        { value: 'alpha', textValue: 'Alpha' },
        { value: 'beta', textValue: 'Beta' },
        { value: 'gamma', textValue: 'Gamma' },
      ]
    ).map((props) => {
      const item = document.createElement(`${family}-select-item`) as any;
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

  describe(`${family}: complete inherited Select protocol`, () => {
    it('keeps all five direct identities, wrapping slots, logical alignment and collision-bounded portal styles', async () => {
      vi.useFakeTimers();
      for (const part of ['Root', 'Trigger', 'Value', 'Content', 'Item'] as const)
        expect(projection[`select${part}`].name).toBe(`${family}-select-${part.toLowerCase()}`);
      const long = 'LongUnbrokenOptionLabels'.repeat(15);
      const { root, trigger, value, content, items } = createSelect({
        root: { defaultValue: 'long' },
        items: [{ value: 'long', textValue: long }],
      });
      await settle();
      expect(value.textContent).toBe(long);
      for (const host of [root, trigger, value, items[0]])
        expect(styleContains(host, 'min-w-0')).toBe(true);
      for (const host of [trigger, value, items[0]]) {
        expect(styleContains(host, 'text-start')).toBe(true);
        expect(styleContains(host, 'whitespace-normal')).toBe(true);
        expect(
          (host.getAttribute('data-pui-style') ?? '')
            .split(/\s+/)
            .some((token: string) => /^h-/.test(token))
        ).toBe(false);
      }
      expect(styleContains(value, 'pointer-events-none')).toBe(true);
      trigger.click();
      await settle();
      expect(content.getExposes().isPresent.get()).toBe(true);
      expect(
        styleContains(content, family === 'bootstrap-2-3-2' ? 'bg-background' : 'bg-secondary')
      ).toBe(true);
      expect(styleContains(content, 'max-w-[var(--proto-ui-available-width)]')).toBe(true);
      expect(styleContains(content, 'max-h-[var(--proto-ui-available-height)]')).toBe(true);
      expect(items[0].querySelector('svg path')?.getAttribute('d')).toBe('m20 6-11 11-5-5');
      expect(trigger.querySelector('svg')).not.toBeNull();
    });

    it('owns single-selection facts, collection, anatomy, and live selected text', async () => {
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

    it('uses Transition as Overlay presence and applies anchored positioning props', async () => {
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
}
