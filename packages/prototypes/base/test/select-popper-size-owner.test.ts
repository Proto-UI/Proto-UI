import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AdaptToWebComponent,
  getElementProps,
  setElementProps,
  type WebComponentAdapterElement,
} from '@proto.ui/adapter-web-component';
import {
  selectContent,
  selectItem,
  selectRoot,
  selectTrigger,
  selectValue,
  selectSurface,
  selectViewport,
  selectItemText,
} from '../src/select';

AdaptToWebComponent(selectRoot);
AdaptToWebComponent(selectTrigger);
AdaptToWebComponent(selectValue);
AdaptToWebComponent(selectContent);
AdaptToWebComponent(selectItem);
AdaptToWebComponent(selectSurface);
AdaptToWebComponent(selectViewport);
AdaptToWebComponent(selectItemText);

async function settle() {
  await vi.advanceTimersByTimeAsync(0);
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(async () => {
  document.body.replaceChildren();
  await Promise.resolve();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function update(element: HTMLElement, changes: Record<string, unknown>) {
  const previous = { ...getElementProps(element) };
  const complete = { ...previous, ...changes };
  setElementProps(element, complete);
  expect(getElementProps(element)).toEqual(complete);
  for (const key of ['open', 'value', 'textValue', 'disabled', 'itemSizing', 'position']) {
    if (Object.hasOwn(previous, key) && !Object.hasOwn(changes, key))
      expect(getElementProps(element)?.[key]).toBe(previous[key]);
  }
}

// Actual WC/Content/Overlay/Focus owners; only physical used-layout facts are
// controlled. A row stays intrinsic until the real host writes its owned CSS.
// This is adapter-unit evidence, not native browser layout acceptance.
function fixture(policy: 'intrinsic' | 'match-trigger') {
  const geometry = { width: 180, height: 36, refuseRowWidth: false };
  const observers: ControlledResizeObserver[] = [];
  class ControlledResizeObserver implements ResizeObserver {
    active = true;
    readonly targets = new Set<Element>();
    constructor(private readonly callback: ResizeObserverCallback) {
      observers.push(this);
    }
    observe(target: Element) {
      this.targets.add(target);
    }
    unobserve(target: Element) {
      this.targets.delete(target);
    }
    disconnect() {
      this.active = false;
      this.targets.clear();
    }
    fire() {
      this.callback([], this);
    }
  }
  vi.stubGlobal('ResizeObserver', ControlledResizeObserver);
  const root = document.createElement('base-select-root') as WebComponentAdapterElement<
    typeof selectRoot
  >;
  const trigger = document.createElement('base-select-trigger') as WebComponentAdapterElement<
    typeof selectTrigger
  >;
  const value = document.createElement('base-select-value');
  const content = document.createElement('base-select-content') as WebComponentAdapterElement<
    typeof selectContent
  >;
  const surface = document.createElement('base-select-surface');
  const viewport = document.createElement('base-select-viewport');
  const items = [
    { value: 'alpha', textValue: 'Alpha' },
    { value: 'beta', textValue: 'Beta' },
    { value: 'gamma', textValue: 'Gamma', disabled: true },
    { value: 'delta', textValue: 'Delta', itemSizing: 'intrinsic' },
  ].map((props) => {
    const item = document.createElement('base-select-item') as WebComponentAdapterElement<
      typeof selectItem
    >;
    setElementProps(item, props);
    item.style.cssText = 'margin:0px;border:0px solid transparent;padding:0px;';
    const text = document.createElement('base-select-item-text');
    text.textContent = props.textValue;
    item.append(text);
    viewport.append(item);
    return item;
  });
  surface.style.cssText = 'margin:0px;border:1px solid black;padding:0px;';
  viewport.style.cssText = 'margin:0px;border:0px solid transparent;padding:4px;';
  surface.append(viewport);
  content.append(surface);
  trigger.append(value);
  root.append(trigger, content);
  setElementProps(root, { open: false, value: 'alpha', itemSizing: policy });
  setElementProps(content, {
    position: 'popper',
    side: 'bottom',
    align: 'start',
    sideOffset: 4,
    avoidCollisions: false,
  });
  const requested = (element: HTMLElement, key: 'width' | 'height', fallback: number) => {
    const parsed = Number.parseFloat(element.style[key]);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const rowWidth = (item: HTMLElement) =>
    geometry.refuseRowWidth ? 142 : requested(item, 'width', 142);
  const rowHeight = (item: HTMLElement) => requested(item, 'height', 32);
  const surfaceWidth = () => {
    let result = Math.max(...items.map(rowWidth)) + 10;
    for (let node: HTMLElement | null = surface; node; node = node.parentElement)
      result = Math.max(
        result,
        requested(node, 'width', 0),
        Number.parseFloat(node.style.minWidth) || 0
      );
    return result;
  };
  const usedWidth = (element: HTMLElement): number => {
    if (element === document.documentElement || element === document.body) return window.innerWidth;
    if (element === trigger) return geometry.width;
    if (items.some((item) => item === element)) return rowWidth(element);
    if (element === value || element.tagName === 'BASE-SELECT-ITEM-TEXT') return 50;
    if (element === viewport) return surfaceWidth() - 2;
    return surfaceWidth();
  };
  const usedHeight = (element: HTMLElement): number => {
    if (element === document.documentElement || element === document.body)
      return window.innerHeight;
    if (element === trigger) return geometry.height;
    if (items.some((item) => item === element)) return rowHeight(element);
    if (element === value || element.tagName === 'BASE-SELECT-ITEM-TEXT') return 20;
    return items.reduce((sum, item) => sum + rowHeight(item), element === viewport ? 8 : 10);
  };
  for (const key of ['offsetWidth', 'clientWidth', 'scrollWidth'] as const)
    vi.spyOn(HTMLElement.prototype, key, 'get').mockImplementation(function (this: HTMLElement) {
      if (key === 'scrollWidth' && items.some((item) => item === this)) return 100;
      return usedWidth(this) - (key === 'clientWidth' && this === surface ? 2 : 0);
    });
  for (const key of ['offsetHeight', 'clientHeight', 'scrollHeight'] as const)
    vi.spyOn(HTMLElement.prototype, key, 'get').mockImplementation(function (this: HTMLElement) {
      if (key === 'scrollHeight' && items.some((item) => item === this)) return 24;
      return usedHeight(this) - (key === 'clientHeight' && this === surface ? 2 : 0);
    });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement
  ) {
    const x = this === trigger ? 180 : Number.parseFloat(this.style.left) || 0;
    const y = this === trigger ? 240 : Number.parseFloat(this.style.top) || 0;
    const width = usedWidth(this),
      height = usedHeight(this);
    return {
      x,
      y,
      width,
      height,
      left: x,
      top: y,
      right: x + width,
      bottom: y + height,
      toJSON() {},
    } as DOMRect;
  });
  document.body.append(root);
  return { root, trigger, value, content, surface, viewport, items, geometry, observers };
}

function assertOwner(f: ReturnType<typeof fixture>, focused: number) {
  expect(f.content.getExposes().alignmentDiagnostic.get()).toBe('');
  expect(f.content.getExposes().transitionState.get()).toBe('entered');
  expect(document.activeElement).toBe(f.items[focused]);
  expect(f.items.map((item) => item.getExposes().active.get())).toEqual(
    f.items.map((_item, index) => index === focused)
  );
  expect(f.root.getExposes().value.get()).toBe('alpha');
  expect(f.root.getExposes().open.get()).toBe(true);
  expect(getElementProps(f.content)?.position).toBe('popper');
}

function assertMatched(f: ReturnType<typeof fixture>) {
  expect([f.trigger.offsetWidth, f.trigger.offsetHeight]).toEqual([180, 36]);
  for (const item of f.items.slice(0, 3)) {
    expect([item.offsetWidth, item.offsetHeight]).toEqual([180, 36]);
    expect([item.style.width, item.style.height]).toEqual(['180px', '36px']);
  }
  expect([f.items[3].offsetWidth, f.items[3].offsetHeight]).toEqual([142, 32]);
  expect([f.items[3].style.width, f.items[3].style.height]).toEqual(['', '']);
}

describe('Select popper size policy real Content owner', () => {
  it('preserves ordinary intrinsic edge placement and selected entry without owned row sizes', async () => {
    vi.useFakeTimers();
    const f = fixture('intrinsic');
    await settle();
    update(f.root, { open: true });
    await settle();
    assertOwner(f, 0);
    expect(f.items.map((item) => [item.offsetWidth, item.offsetHeight])).toEqual([
      [142, 32],
      [142, 32],
      [142, 32],
      [142, 32],
    ]);
    expect(f.items.every((item) => !item.style.width && !item.style.height)).toBe(true);
    expect(f.content.style.top).toBe('280px');
  });
  it('admits current popper only after actual inherited rows match the Trigger including disabled rows', async () => {
    vi.useFakeTimers();
    const f = fixture('match-trigger');
    await settle();
    update(f.root, { open: true });
    await settle();
    assertMatched(f);
    assertOwner(f, 0);
    expect(f.surface.style.position).toBe('fixed');
    expect(f.surface.style.left).toBe('180px');
    expect(f.surface.style.top).toBe('280px');
    expect(f.surface.getAttribute('data-side')).toBe('bottom');
    expect(f.content.style.top).toBe('');
  });
  it('withdraws owned sizes on policy change and close without changing value or stealing a newer active row', async () => {
    vi.useFakeTimers();
    const f = fixture('match-trigger');
    await settle();
    const events: string[] = [];
    f.root.addEventListener('valueChange', () => events.push('value'));
    f.root.addEventListener('openChange', () => events.push('open'));
    update(f.root, { open: true });
    await settle();
    assertMatched(f);
    f.items[1].getExposes().focusSelf({ reason: 'keyboard' });
    await settle();
    assertOwner(f, 1);
    update(f.root, { itemSizing: 'intrinsic' });
    await settle();
    assertOwner(f, 1);
    expect(f.items.every((item) => !item.style.width && !item.style.height)).toBe(true);
    update(f.root, { open: false });
    await settle();
    expect(f.content.getExposes().transitionState.get()).toBe('closed');
    expect(f.items.every((item) => !item.style.width && !item.style.height)).toBe(true);
    expect(f.root.getExposes().value.get()).toBe('alpha');
    expect(events).toEqual([]);
  });
});

describe('Select popper size owner interrupted admission', () => {
  it('keeps a zero-layout cold entry hidden and unfocused until real current measurement succeeds', async () => {
    vi.useFakeTimers();
    const f = fixture('match-trigger');
    f.geometry.width = 0;
    await settle();
    update(f.root, { open: true });
    await settle();
    expect(f.content.getExposes().transitionState.get()).toBe('preparing');
    expect(f.content.getExposes().alignmentDiagnostic.get()).toBe('');
    expect(f.items.some((item) => item === document.activeElement)).toBe(false);
    // Root seeds the logical active value before entry; Focus still owns no Item.
    expect(f.items.map((item) => item.getExposes().active.get())).toEqual([
      true,
      false,
      false,
      false,
    ]);
    expect(f.items.map((item) => item.getExposes().focused.get())).toEqual([
      false,
      false,
      false,
      false,
    ]);
    f.geometry.width = 180;
    for (const observer of [...f.observers]) if (observer.active) observer.fire();
    await settle();
    assertMatched(f);
    assertOwner(f, 0);
  });
  it('preserves newer focused and active Beta across intrinsic to matched sizing and back', async () => {
    vi.useFakeTimers();
    const f = fixture('intrinsic');
    await settle();
    update(f.root, { open: true });
    await settle();
    assertOwner(f, 0);
    f.items[1].getExposes().focusSelf({ reason: 'keyboard' });
    await settle();
    assertOwner(f, 1);
    update(f.root, { itemSizing: 'match-trigger' });
    await settle();
    assertMatched(f);
    assertOwner(f, 1);
    update(f.root, { itemSizing: 'intrinsic' });
    await settle();
    assertOwner(f, 1);
    expect(f.items.every((item) => !item.style.width && !item.style.height)).toBe(true);
  });
  it('fails closed when actual used row width refuses the requested CSS size', async () => {
    vi.useFakeTimers();
    const f = fixture('match-trigger');
    f.geometry.refuseRowWidth = true;
    await settle();
    update(f.root, { open: true });
    await settle();
    expect(f.content.getExposes().transitionState.get()).toBe('closed');
    expect(f.content.getExposes().alignmentDiagnostic.get()).toBe('select.geometry.size-conflict');
    expect(f.root.getExposes().open.get()).toBe(true);
    expect(f.root.getExposes().value.get()).toBe('alpha');
    expect(f.items.some((item) => item === document.activeElement)).toBe(false);
    expect(f.items.every((item) => !item.style.width && !item.style.height)).toBe(true);
  });
  it('ignores retired physical observer callbacks after close and admits the reopened current selection', async () => {
    vi.useFakeTimers();
    const f = fixture('match-trigger');
    await settle();
    update(f.root, { open: true });
    await settle();
    assertMatched(f);
    assertOwner(f, 0);
    const oldObservers = [...f.observers];
    update(f.root, { open: false });
    await settle();
    for (const observer of oldObservers) observer.fire();
    await settle();
    expect(f.content.getExposes().transitionState.get()).toBe('closed');
    expect(f.items.every((item) => !item.style.width && !item.style.height)).toBe(true);
    update(f.root, { open: true, value: 'beta' });
    await settle();
    assertMatched(f);
    expect(document.activeElement).toBe(f.items[1]);
    for (const observer of oldObservers) observer.fire();
    await settle();
    expect(document.activeElement).toBe(f.items[1]);
    expect(f.items.map((item) => item.getExposes().active.get())).toEqual([
      false,
      true,
      false,
      false,
    ]);
    expect(f.root.getExposes().value.get()).toBe('beta');
    expect(f.root.getExposes().open.get()).toBe(true);
  });
});

it('does not resurrect sizing-only focus rights after a pending value excursion returns to Alpha', async () => {
  vi.useFakeTimers();
  const f = fixture('match-trigger');
  await settle();
  update(f.root, { open: true });
  await settle();
  assertMatched(f);
  f.items[1].getExposes().focusSelf({ reason: 'keyboard' });
  await settle();
  assertOwner(f, 1);
  f.geometry.width = 0;
  update(f.root, { value: 'beta' });
  await settle();
  update(f.root, { value: 'alpha' });
  await settle();
  f.geometry.width = 180;
  for (const observer of [...f.observers]) if (observer.active) observer.fire();
  await settle();
  assertMatched(f);
  assertOwner(f, 0);
});
