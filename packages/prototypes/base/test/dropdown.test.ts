import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { dropdownContent, dropdownItem, dropdownRoot, dropdownTrigger } from '../src/dropdown';

AdaptToWebComponent(dropdownRoot as any);
AdaptToWebComponent(dropdownTrigger as any);
AdaptToWebComponent(dropdownContent as any);
AdaptToWebComponent(dropdownItem as any);

const rect = (x: number, y: number, width: number, height: number): DOMRect =>
  ({
    x,
    y,
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
    width,
    height,
    toJSON: () => ({}),
  }) as DOMRect;

function setRect(element: HTMLElement, value: DOMRect): void {
  element.getBoundingClientRect = () => value;
  Object.defineProperties(element, {
    offsetWidth: { configurable: true, get: () => value.width },
    offsetHeight: { configurable: true, get: () => value.height },
  });
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
  await flush();
}

function createMenu(options?: {
  root?: Record<string, unknown>;
  content?: Record<string, unknown>;
  items?: Array<Record<string, unknown>>;
}) {
  const root = document.createElement('base-dropdown-root') as any;
  const trigger = document.createElement('base-dropdown-trigger') as any;
  const content = document.createElement('base-dropdown-content') as any;
  const items = (
    options?.items ?? [
      { value: 'alpha', textValue: 'Alpha' },
      { value: 'beta', textValue: 'Beta' },
    ]
  ).map((props) => {
    const item = document.createElement('base-dropdown-item') as any;
    setElementProps(item, props);
    item.textContent = String(props.textValue ?? props.value ?? 'Item');
    content.appendChild(item);
    return item;
  });
  setElementProps(root, options?.root ?? {});
  setElementProps(content, options?.content ?? {});
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

describe('prototypes/base: dropdown-menu', () => {
  it('owns uncontrolled visibility, ordered collection, anatomy, and transient active state', async () => {
    // T-BASE-DROPDOWN-MENU-0001-CASE-ROOT-OWNERSHIP
    // T-BASE-DROPDOWN-MENU-0001-CASE-TRANSIENT-ACTIVE
    vi.useFakeTimers();
    const { root, trigger, content, items } = createMenu();
    await flush();

    expect(root.getExposes().open.get()).toBe(false);
    expect(root.getExposes()).toHaveProperty('requestOpen');
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);
    expect(
      root
        .getExposes()
        .getCollectionItems()
        .map((item: any) => item.value)
    ).toEqual(['alpha', 'beta']);

    trigger.click();
    await settle();
    expect(root.getExposes().open.get()).toBe(true);
    expect(content.getAttribute('role')).toBe('menu');
    expect(document.activeElement).toBe(items[0]);
    expect(items[0].getExposes().active.get()).toBe(true);

    trigger.click();
    await settle();
    expect(root.getExposes().open.get()).toBe(false);
    expect(items.every((item) => item.getExposes().active.get() === false)).toBe(true);
  });

  it('emits controlled requests without replacing the owner open fact', async () => {
    // T-BASE-DROPDOWN-MENU-0001-CASE-REQUESTS
    vi.useFakeTimers();
    const { root, trigger, content } = createMenu({ root: { open: false } });
    const requests: any[] = [];
    root.addEventListener('openChange', (event: Event) => {
      requests.push((event as CustomEvent).detail);
    });
    await flush();

    trigger.click();
    await settle();
    expect(root.getExposes().open.get()).toBe(false);
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);
    expect(requests.at(-1)).toEqual(
      expect.objectContaining({ open: true, reason: 'trigger.press', focusReason: 'pointer' })
    );

    setElementProps(root, { open: true });
    await settle();
    root.getExposes().close('root.method.close');
    expect(root.getExposes().open.get()).toBe(true);
    expect(requests.at(-1)).toEqual(
      expect.objectContaining({ open: false, reason: 'root.method.close' })
    );
  });

  it('projects menu-button accessibility and suppresses a disabled Trigger', async () => {
    // T-BASE-DROPDOWN-MENU-TRIGGER-0001-CASE-COMMAND-A11Y
    // T-BASE-DROPDOWN-MENU-TRIGGER-0001-CASE-DISABLED
    vi.useFakeTimers();
    const { root, trigger, content } = createMenu();
    await flush();

    expect(trigger.getAttribute('role')).toBe('button');
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-controls')).toMatch(/^pui-dropdown-\d+-content$/);
    expect(trigger.getExposes()).not.toHaveProperty('click');

    setElementProps(trigger, { disabled: true });
    await flush();
    trigger.click();
    await settle();
    expect(root.getExposes().open.get()).toBe(false);
    expect(trigger.getAttribute('aria-disabled')).toBe('true');
    expect(trigger.getAttribute('tabindex')).not.toBe('0');
  });

  it.each([
    ['Enter', 'alpha'],
    [' ', 'alpha'],
    ['ArrowDown', 'alpha'],
    ['ArrowUp', 'beta'],
  ])('opens from Trigger %j and focuses %s exactly once', async (key, value) => {
    // T-BASE-DROPDOWN-MENU-TRIGGER-0001-CASE-KEYBOARD
    vi.useFakeTimers();
    const { root, trigger, items } = createMenu();
    const requests: any[] = [];
    root.addEventListener('openChange', (event: Event) =>
      requests.push((event as CustomEvent).detail)
    );
    await flush();

    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    if (key === 'Enter' || key === ' ') {
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    }
    await settle();
    expect(root.getExposes().open.get()).toBe(true);
    expect(document.activeElement).toBe(
      items.find((item) => item.getAttribute('data-value') === value) ??
        (value === 'alpha' ? items[0] : items[1])
    );
    expect(requests.filter((request) => request.open).length).toBe(1);
  });

  it('focuses keyboard entry when an Item joins the open anatomy', async () => {
    // T-BASE-DROPDOWN-MENU-TRIGGER-0001-CASE-KEYBOARD
    vi.useFakeTimers();
    const root = document.createElement('base-dropdown-root') as any;
    const trigger = document.createElement('base-dropdown-trigger') as any;
    const content = document.createElement('base-dropdown-content') as any;
    trigger.textContent = 'Actions';
    root.append(trigger, content);
    document.body.appendChild(root);
    await flush();

    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await flush();
    expect(root.getExposes().open.get()).toBe(true);
    expect(document.activeElement).toBe(trigger);

    const item = document.createElement('base-dropdown-item') as any;
    setElementProps(item, { value: 'late', textValue: 'Late item' });
    item.textContent = 'Late item';
    content.appendChild(item);
    await flush();

    expect(document.activeElement).toBe(item);
  });

  it('preserves host scroll while entry focus waits for positioned portal layout', async () => {
    // T-BASE-DROPDOWN-MENU-CONTENT-0001-CASE-A11Y-FOCUS
    vi.useFakeTimers();
    const { trigger, items } = createMenu();
    await flush();
    const focus = vi.spyOn(items[0]!, 'focus');

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();

    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(document.activeElement).toBe(items[0]);
  });

  it('preserves host scroll when open entry resolves an existing value', async () => {
    // T-BASE-DROPDOWN-MENU-CONTENT-0001-CASE-A11Y-FOCUS
    vi.useFakeTimers();
    const { trigger, items } = createMenu({
      root: { openEntry: 'value-or-first', openEntryValue: 'beta' },
    });
    await flush();
    const focus = vi.spyOn(items[1]!, 'focus');

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();

    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(document.activeElement).toBe(items[1]);
  });

  it('accepts a key event owned by Trigger before its focus snapshot settles', async () => {
    // T-BASE-DROPDOWN-MENU-TRIGGER-0001-CASE-KEYBOARD
    vi.useFakeTimers();
    const { root, trigger, items } = createMenu();
    await flush();

    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await settle();

    expect(root.getExposes().open.get()).toBe(true);
    expect(document.activeElement).toBe(items[0]);
  });

  it('navigates Arrow keys, Home/End, and typeahead without wrapping', async () => {
    // T-BASE-DROPDOWN-MENU-CONTENT-0001-CASE-KEYBOARD
    vi.useFakeTimers();
    const { items } = createMenu({ root: { defaultOpen: true } });
    await settle();
    expect(document.activeElement).toBe(items[0]);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    await flush();
    expect(document.activeElement).toBe(items[1]);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    await flush();
    expect(document.activeElement).toBe(items[1]);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    await flush();
    expect(document.activeElement).toBe(items[0]);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }));
    await flush();
    expect(document.activeElement).toBe(items[1]);
  });

  it('expires the typeahead buffer through the runtime delay policy', async () => {
    // T-BASE-DROPDOWN-MENU-CONTENT-0001-CASE-KEYBOARD
    vi.useFakeTimers();
    const { items } = createMenu({
      root: { defaultOpen: true },
      items: [
        { value: 'apple', textValue: 'Apple' },
        { value: 'apricot', textValue: 'Apricot' },
        { value: 'banana', textValue: 'Banana' },
      ],
    });
    await settle();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flush();
    expect(document.activeElement).toBe(items[1]);

    await vi.advanceTimersByTimeAsync(400);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' }));
    await flush();
    expect(document.activeElement).toBe(items[1]);
  });

  it('keeps disabled Item focusable in menu navigation but suppresses select and close', async () => {
    // T-BASE-DROPDOWN-MENU-ITEM-0001-CASE-DISABLED
    vi.useFakeTimers();
    const { root, items } = createMenu({
      root: { defaultOpen: true },
      items: [
        { value: 'alpha', textValue: 'Alpha' },
        { value: 'beta', textValue: 'Beta', disabled: true },
      ],
    });
    const selections: any[] = [];
    items[1].addEventListener('select', (event: Event) =>
      selections.push((event as CustomEvent).detail)
    );
    await settle();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    await flush();
    expect(document.activeElement).toBe(items[1]);
    expect(items[1].getAttribute('aria-disabled')).toBe('true');
    items[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle();
    expect(selections).toEqual([]);
    expect(root.getExposes().open.get()).toBe(true);
  });

  it('emits Item select and honors root and item commit-close policies', async () => {
    // T-BASE-DROPDOWN-MENU-ITEM-0001-CASE-ACTIVE-SELECT
    vi.useFakeTimers();
    const { root, trigger, items } = createMenu({
      root: { defaultOpen: true, closeOnItemCommit: false },
      items: [{ value: 'alpha', textValue: 'Alpha', closeOnCommit: true }],
    });
    const selections: any[] = [];
    items[0].addEventListener('select', (event: Event) =>
      selections.push((event as CustomEvent).detail)
    );
    await settle();

    items[0].click();
    await settle();
    expect(selections).toEqual([{ value: 'alpha', reason: 'pointer' }]);
    expect(root.getExposes().open.get()).toBe(false);
    expect(document.activeElement).toBe(trigger);
    expect(items[0].getExposes().active.get()).toBe(false);
    expect(items[0].hasAttribute('aria-selected')).toBe(false);
    expect(items[0].hasAttribute('aria-checked')).toBe(false);
  });

  it('does not steal focus established by an Item action while closing', async () => {
    // T-BASE-DROPDOWN-MENU-CONTENT-0001-CASE-DISMISS
    vi.useFakeTimers();
    const { root, items } = createMenu({ root: { defaultOpen: true } });
    const actionTarget = document.createElement('button');
    actionTarget.textContent = 'Action target';
    document.body.appendChild(actionTarget);
    items[0].addEventListener('select', () => actionTarget.focus());
    await settle();

    expect(document.activeElement).toBe(items[0]);
    items[0].click();
    await settle();

    expect(root.getExposes().open.get()).toBe(false);
    expect(document.activeElement).toBe(actionTarget);
  });

  it('requests Escape, Tab, and outside dismissal while preserving controlled ownership', async () => {
    // T-BASE-DROPDOWN-MENU-CONTENT-0001-CASE-DISMISS
    vi.useFakeTimers();
    const { root, trigger } = createMenu({ root: { defaultOpen: true } });
    await settle();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await settle();
    expect(root.getExposes().open.get()).toBe(false);
    expect(document.activeElement).toBe(trigger);

    trigger.click();
    await settle();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    await settle();
    expect(root.getExposes().open.get()).toBe(false);

    trigger.click();
    await settle();
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await settle();
    expect(root.getExposes().open.get()).toBe(false);
  });

  it('classifies the Trigger anchor as inside so one pointer activation only closes', async () => {
    // T-BASE-DROPDOWN-MENU-CONTENT-0001-CASE-DISMISS
    vi.useFakeTimers();
    const { root, trigger } = createMenu();
    await flush();

    trigger.click();
    await settle();
    expect(root.getExposes().open.get()).toBe(true);

    trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    trigger.click();
    await settle();

    expect(root.getExposes().open.get()).toBe(false);
  });

  it('uses rendered anchor geometry by default and forwards the explicit translation policy', async () => {
    vi.useFakeTimers();
    const { root, trigger, content } = createMenu({
      content: { sideOffset: 0, align: 'start', avoidCollisions: false },
    });
    setRect(trigger, rect(101, 101, 50, 20));
    setRect(content, rect(0, 0, 40, 10));
    const nativeGetComputedStyle = window.getComputedStyle;
    const styleSpy = vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
      if (element === trigger)
        return { transform: 'matrix(1, 0, 0, 1, -1, -1)' } as CSSStyleDeclaration;
      return nativeGetComputedStyle(element);
    });
    trigger.click();
    await settle();

    // Base default false: actual rendered rect drives placement.
    expect(content.style.left).toBe('101px');
    expect(content.style.top).toBe('121px');

    // Per-instance opt-in forwards through Prototype -> Overlay -> host.
    content.setProps({
      sideOffset: 0,
      align: 'start',
      avoidCollisions: false,
      excludeAnchorTranslation: true,
    });
    root.getExposes().close('test.policy-override');
    await settle();
    trigger.click();
    await settle();
    expect(content.style.left).toBe('102px');
    expect(content.style.top).toBe('122px');
    styleSpy.mockRestore();
  });

  it('portals, positions from Trigger, and retains leave presence through Transition', async () => {
    // T-BASE-DROPDOWN-MENU-CONTENT-0001-CASE-PRESENCE-POSITION
    vi.useFakeTimers();
    const { root, trigger, content } = createMenu({
      content: {
        side: 'top',
        align: 'start',
        avoidCollisions: false,
        enterDuration: 20,
        leaveDuration: 30,
      },
    });
    await flush();
    trigger.click();
    await settle();

    expect(content.parentElement).toBe(document.body);
    expect(content.style.position).toBe('fixed');
    expect(content.dataset.side).toBe('top');
    expect(content.dataset.align).toBe('start');
    expect(content.getExposes().transitionState.get()).toBe('entering');

    root.getExposes().close('test.close');
    await flush();
    expect(content.getExposes().transitionState.get()).toBe('leaving');
    expect(content.hasAttribute('data-pui-view-detached')).toBe(false);
    await vi.advanceTimersByTimeAsync(30);
    await flush();
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);
  });
});
