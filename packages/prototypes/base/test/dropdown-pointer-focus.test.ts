import { afterEach, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  dropdownContent,
  dropdownItem,
  dropdownRoot,
  dropdownShortcut,
  dropdownTrigger,
} from '../src/dropdown';

// Real source Runtime and WC input router, synthetic host input. This suite
// does not establish native input, browser paint or compiled-host acceptance.
const Root = AdaptToWebComponent(dropdownRoot, { register: false });
const Content = AdaptToWebComponent(dropdownContent, { register: false });
const Trigger = AdaptToWebComponent(dropdownTrigger, { register: false });
const Item = AdaptToWebComponent(dropdownItem, { register: false });
const Shortcut = AdaptToWebComponent(dropdownShortcut, { register: false });
customElements.define('dropdown-pointer-focus-root', Root);
customElements.define('dropdown-pointer-focus-content', Content);
customElements.define('dropdown-pointer-focus-trigger', Trigger);
customElements.define('dropdown-pointer-focus-item', Item);
customElements.define('dropdown-pointer-focus-shortcut', Shortcut);

const pointer = (type: string, pointerType = 'mouse', buttons = 0) =>
  new PointerEvent(type, { bubbles: true, composed: true, pointerType, buttons });
async function settle() {
  await vi.advanceTimersByTimeAsync(0);
  for (let index = 0; index < 10; index++) await Promise.resolve();
}
async function fixture(rootProps: Record<string, unknown> = {}) {
  vi.useFakeTimers();
  const root = new Root();
  const trigger = new Trigger();
  const content = new Content();
  const shortcuts: InstanceType<typeof Shortcut>[] = [];
  const items = ['alpha', 'beta', 'gamma'].map((value) => {
    const item = new Item();
    setElementProps(item, { value, textValue: value });
    item.textContent = value;
    const shortcut = new Shortcut();
    shortcut.textContent = '⌘P';
    shortcuts.push(shortcut);
    item.append(shortcut);
    content.append(item);
    return item;
  });
  setElementProps(root, { defaultOpen: true, ...rootProps });
  setElementProps(content, { enterDuration: 0, leaveDuration: 0 });
  root.append(trigger, content);
  const requests: Array<{ event: string; detail: unknown }> = [];
  root.addEventListener('openChange', (event) =>
    requests.push({ event: 'openChange', detail: (event as CustomEvent).detail })
  );
  for (const item of items) {
    item.addEventListener('select', (event) =>
      requests.push({ event: 'select', detail: (event as CustomEvent).detail })
    );
  }
  document.body.append(root);
  await settle();
  expect(document.activeElement).toBe(items[0]);
  requests.length = 0;
  const focused = () => items.map((item) => item.getExposes().focused.get());
  const active = () => items.map((item) => item.getExposes().active.get());
  const move = async (index: number) => {
    items[index].dispatchEvent(pointer('pointerenter'));
    items[index].dispatchEvent(pointer('pointermove'));
    await settle();
  };
  const shortcutActive = () =>
    shortcuts.map((shortcut) => (shortcut.getExposes().active as { get(): boolean }).get());
  return { root, trigger, content, items, requests, focused, active, shortcutActive, move };
}
afterEach(async () => {
  document.body.replaceChildren();
  await settle();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it.each([
  ['uncontrolled', {}],
  ['controlled', { open: true }],
] as const)(
  'hands mouse navigation to one focused item without activation (%s)',
  async (_mode, rootProps) => {
    const f = await fixture(rootProps);
    const focus = vi.spyOn(f.items[1], 'focus');
    await f.move(1);
    expect(document.activeElement).toBe(f.items[1]);
    expect(f.focused()).toEqual([false, true, false]);
    expect(f.active()).toEqual([false, true, false]);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(f.root.getExposes().open.get()).toBe(true);
    expect(f.requests).toEqual([]);
  }
);

it('resumes the hovered row after keyboard navigation without requiring another pointer enter', async () => {
  const f = await fixture();
  await f.move(1);
  f.items[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  await settle();
  expect(document.activeElement).toBe(f.items[2]);
  f.items[1].dispatchEvent(pointer('pointermove'));
  await settle();
  expect(document.activeElement).toBe(f.items[1]);
  expect(f.focused()).toEqual([false, true, false]);
  expect(f.active()).toEqual([false, true, false]);
  await f.move(0);
  expect(f.active()).toEqual([true, false, false]);
  expect(f.requests).toEqual([]);
});

it.each([
  ['touch', 0],
  ['pen', 0],
  ['unknown', 0],
  ['mouse', 1],
] as const)(
  'does not turn %s movement with buttons=%s into mouse-hover focus',
  async (pointerType, buttons) => {
    const f = await fixture();
    f.items[1].dispatchEvent(pointer('pointermove', pointerType, buttons));
    await settle();
    expect(document.activeElement).toBe(f.items[0]);
    expect(f.focused()).toEqual([true, false, false]);
    expect(f.active()).toEqual([true, false, false]);
    expect(f.requests).toEqual([]);
  }
);

it('keeps disabled rows keyboard-focusable but rejects pointer focus and activation', async () => {
  const f = await fixture();
  setElementProps(f.items[1], { disabled: true });
  await settle();
  await f.move(1);
  expect(document.activeElement).toBe(f.items[0]);
  f.items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  await settle();
  expect(document.activeElement).toBe(f.items[1]);
  f.items[1].click();
  await settle();
  expect(f.requests).toEqual([]);
  expect(f.root.getExposes().open.get()).toBe(true);
  await f.move(2);
  expect(document.activeElement).toBe(f.items[2]);
  expect(f.active()).toEqual([false, false, true]);
});

it('rejects a disabled Root and a closed retained view without stealing external focus', async () => {
  const f = await fixture();
  setElementProps(f.root, { disabled: true });
  await settle();
  f.items[1].dispatchEvent(pointer('pointermove'));
  await settle();
  expect(document.activeElement).toBe(f.items[0]);
  setElementProps(f.root, { disabled: false });
  await settle();
  f.root
    .getExposes()
    .requestOpen({ open: false, reason: 'test.close', focusReason: 'programmatic' });
  await settle();
  const outside = document.createElement('button');
  document.body.append(outside);
  outside.focus();
  f.requests.length = 0;
  f.items[1].dispatchEvent(pointer('pointermove'));
  await settle();
  expect(document.activeElement).toBe(outside);
  expect(f.root.getExposes().open.get()).toBe(false);
  expect(f.requests).toEqual([]);
});

it('does not require a collection value for pointer focus', async () => {
  const f = await fixture();
  setElementProps(f.items[1], { value: '' });
  await settle();
  await f.move(1);
  expect(document.activeElement).toBe(f.items[1]);
  expect(f.focused()).toEqual([false, true, false]);
  expect(f.active()).toEqual([false, true, false]);
  expect(f.shortcutActive()).toEqual([false, true, false]);
  f.items[2].dispatchEvent(pointer('pointermove'));
  await settle();
  expect(f.active()).toEqual([false, false, true]);
  expect(f.shortcutActive()).toEqual([false, false, true]);
  expect(f.requests).toEqual([]);
});
