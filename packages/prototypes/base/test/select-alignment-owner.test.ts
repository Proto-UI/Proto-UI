import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AdaptToWebComponent,
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
  const root = document.createElement('base-select-root') as WebComponentAdapterElement<
    typeof selectRoot
  >;
  const trigger = document.createElement('base-select-trigger') as WebComponentAdapterElement<
    typeof selectTrigger
  >;
  const value = document.createElement('base-select-value') as WebComponentAdapterElement<
    typeof selectValue
  >;
  const content = document.createElement('base-select-content') as WebComponentAdapterElement<
    typeof selectContent
  >;
  const items = (
    options?.items ?? [
      { value: 'alpha', textValue: 'Alpha' },
      { value: 'beta', textValue: 'Beta' },
      { value: 'gamma', textValue: 'Gamma' },
    ]
  ).map((props) => {
    const item = document.createElement('base-select-item') as WebComponentAdapterElement<
      typeof selectItem
    >;
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
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function facts() {
  const box = (left: number, top: number, width: number, height: number) =>
    ({
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height,
      x: left,
      y: top,
      toJSON() {},
    }) as DOMRect;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement
  ) {
    if (this.tagName === 'BASE-SELECT-TRIGGER') return box(180, 240, 180, 36);
    if (this.tagName === 'BASE-SELECT-VALUE') return box(193, 248, 50, 20);
    if (this.tagName === 'BASE-SELECT-SURFACE') return box(0, 0, 180, 106);
    if (this.tagName === 'BASE-SELECT-ITEM-TEXT') return box(13, 37, 50, 20);
    return box(0, 0, 180, 32);
  });
  vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    if (this.tagName === 'BASE-SELECT-TRIGGER') return 180;
    if (this.tagName === 'BASE-SELECT-VALUE') return 193;
    if (this.tagName === 'BASE-SELECT-ITEM-TEXT') return 13;
    return 0;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    return this.tagName === 'BASE-SELECT-VALUE' || this.tagName === 'BASE-SELECT-ITEM-TEXT'
      ? 50
      : 180;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    return this.tagName === 'BASE-SELECT-VIEWPORT'
      ? 104
      : this.tagName === 'BASE-SELECT-SURFACE'
        ? 106
        : 32;
  });
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(104);
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(104);
  vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    return this.tagName === 'BASE-SELECT-ITEM'
      ? 4 + Number(this.getAttribute('data-collection-index')) * 32
      : 0;
  });
}
function full(
  options: { missingText?: boolean; missingSurface?: boolean; controlled?: boolean } = {}
) {
  const f = createSelect({
    root: options.controlled ? { open: false, value: 'beta' } : { defaultValue: 'beta' },
    content: { position: 'item-aligned' },
  });
  const surface = document.createElement('base-select-surface'),
    viewport = document.createElement('base-select-viewport');
  surface.style.cssText = 'border:1px solid black;padding:0px;';
  viewport.style.cssText = 'padding:4px;';
  for (const [index, item] of f.items.entries()) {
    item.textContent = '';
    if (!(options.missingText && index === 1)) {
      const text = document.createElement('base-select-item-text');
      text.textContent = ['Alpha', 'Beta', 'Gamma'][index];
      item.append(text);
    }
    viewport.append(item);
  }
  if (options.missingSurface) f.content.append(viewport);
  else {
    surface.append(viewport);
    f.content.append(surface);
  }
  return { ...f, surface, viewport };
}
describe('Select alignment presentation owner', () => {
  it('aligns a complete real composition and focuses its selected option', async () => {
    vi.useFakeTimers();
    facts();
    const f = full();
    await settle();
    f.trigger.click();
    await settle();
    expect(f.content.getExposes().alignmentDiagnostic.get()).toBe('');
    expect(f.content.getExposes().transitionState.get()).toBe('entered');
    expect(f.content.style.left).toBe('180px');
    expect(document.activeElement).toBe(f.items[1]);
  });
  it('replaces a current represented value without letting unrelated context reset scroll', async () => {
    vi.useFakeTimers();
    facts();
    const f = full({ controlled: true });
    await settle();
    setElementProps(f.root, { open: true, value: 'beta' });
    await settle();
    f.viewport.scrollTop = 37;
    setElementProps(f.root, { open: true, value: 'beta', closeOnSelect: false });
    await settle();
    expect(f.viewport.scrollTop).toBe(37);
    setElementProps(f.root, { open: true, value: 'gamma' });
    await settle();
    expect(f.content.getExposes().alignmentDiagnostic.get()).toBe('');
    expect(document.activeElement).toBe(f.items[2]);
  });
  it('aborts invalid structure without changing Root and ignores unrelated value until structural repair', async () => {
    vi.useFakeTimers();
    facts();
    const f = full({ controlled: true, missingText: true });
    await settle();
    const changes: unknown[] = [];
    f.root.addEventListener('openChange', (e: Event) => changes.push((e as CustomEvent).detail));
    setElementProps(f.root, { open: true, value: 'beta' });
    await settle();
    expect(f.root.getExposes().open.get()).toBe(true);
    expect(f.content.getExposes().transitionState.get()).toBe('closed');
    expect(f.content.getExposes().alignmentDiagnostic.get()).toBe(
      'select.structure.missing-or-ambiguous-item-text'
    );
    expect(changes).toEqual([]);
    setElementProps(f.root, { open: true, value: 'gamma' });
    await settle();
    expect(f.content.getExposes().transitionState.get()).toBe('closed');
    const text = document.createElement('base-select-item-text');
    text.textContent = 'Beta';
    f.items[1].append(text);
    await settle();
    expect(f.content.getExposes().transitionState.get()).toBe('entered');
    expect(f.content.getExposes().alignmentDiagnostic.get()).toBe('');
    expect(document.activeElement).toBe(f.items[2]);
  });
  it('distinguishes unsupported current selection from author structure and recovers only on represented value', async () => {
    vi.useFakeTimers();
    facts();
    const f = full({ controlled: true });
    await settle();
    setElementProps(f.root, { open: true, value: 'beta' });
    await settle();
    setElementProps(f.root, { open: true, value: 'unknown' });
    await settle();
    expect(f.root.getExposes().open.get()).toBe(true);
    expect(f.content.getExposes().alignmentDiagnostic.get()).toBe(
      'select.selection.open-update-compatibility'
    );
    expect(f.content.getExposes().transitionState.get()).toBe('closed');
    setElementProps(f.root, { open: true, value: 'gamma' });
    await settle();
    expect(f.content.getExposes().transitionState.get()).toBe('entered');
    expect(document.activeElement).toBe(f.items[2]);
  });
  it('explicit popper repairs invalid geometry policy without inventing a Root close request', async () => {
    vi.useFakeTimers();
    facts();
    const f = full({ controlled: true, missingSurface: true });
    await settle();
    setElementProps(f.root, { open: true, value: 'beta' });
    await settle();
    expect(f.content.getExposes().transitionState.get()).toBe('closed');
    setElementProps(f.content, { position: 'popper' });
    await settle();
    expect(f.root.getExposes().open.get()).toBe(true);
    expect(f.content.getExposes().transitionState.get()).toBe('entered');
    expect(f.content.getExposes().alignmentDiagnostic.get()).toBe('');
  });
});

import { getElementProps } from '@proto.ui/adapter-web-component';

// setElementProps replaces raw props. Only this test helper models an author
// updating one field while deliberately retaining every other authored input.
function updatePolicyFixtureProps(element: HTMLElement, change: Record<string, unknown>) {
  const previous = { ...getElementProps(element) };
  const complete = { ...previous, ...change };
  setElementProps(element, complete);
  expect(getElementProps(element)).toEqual(complete);
  for (const key of ['open', 'value', 'textValue', 'disabled', 'itemSizing']) {
    if (Object.hasOwn(previous, key) && !Object.hasOwn(change, key)) {
      expect(getElementProps(element)?.[key]).toBe(previous[key]);
    }
  }
}

// The original five owner cases retain their original geometry unchanged.
// New sizing cases model authored zero chrome and used layout after actual
// owned CSS writes. A refused used width remains mismatched even after writes.
function sizingFull(options: { refuseUsedWidth?: boolean } = {}) {
  const f = full({ controlled: true });
  f.surface.style.margin = '0px';
  f.viewport.style.border = '0px solid transparent';
  f.viewport.style.margin = '0px';
  for (const item of f.items) {
    item.style.cssText = 'border:0px solid transparent;padding:0px;margin:0px;';
  }
  const surfaceWidth = () => {
    let width = 180;
    for (let node: HTMLElement | null = f.surface.parentElement; node; node = node.parentElement) {
      width = Math.max(width, parseFloat(node.style.minWidth) || 0);
    }
    return width;
  };
  const usedWidth = (element: HTMLElement): number => {
    if (element === f.trigger) return 180;
    if (element === f.value || element.tagName === 'BASE-SELECT-ITEM-TEXT') return 50;
    if (element === f.surface) return surfaceWidth();
    if (element === f.viewport) return surfaceWidth() - 2;
    if (f.items.some((item) => item === element)) {
      const requested = parseFloat(element.style.width);
      return options.refuseUsedWidth || !Number.isFinite(requested) ? 142 : requested;
    }
    return 180;
  };
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    return usedWidth(this);
  });
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    return usedWidth(this) - (this === f.surface ? 2 : 0);
  });
  const usedHeight = (element: HTMLElement): number => {
    if (element === f.viewport) return f.items.reduce((sum, item) => sum + usedHeight(item), 8);
    if (element === f.surface) return usedHeight(f.viewport) + 2;
    if (f.items.some((item) => item === element)) {
      const requested = parseFloat(element.style.height);
      return Number.isFinite(requested) ? requested : 32;
    }
    return 32;
  };
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    return usedHeight(this);
  });
  vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    const index = f.items.findIndex((item) => item === this);
    return index < 0 ? 0 : f.items.slice(0, index).reduce((sum, item) => sum + usedHeight(item), 4);
  });
  return { ...f, usedWidth, usedHeight };
}

// These cases execute the real Content/Overlay/Focus owner with controlled layout
// facts. They are adapter-unit evidence, not native geometry or pointer evidence.
describe('Select public sizing policy and real presentation focus', () => {
  const assertOwner = (f: ReturnType<typeof full>, focused: number, value: string) => {
    expect(f.content.getExposes().alignmentDiagnostic.get()).toBe('');
    expect(f.content.getExposes().transitionState.get()).toBe('entered');
    expect(document.activeElement).toBe(f.items[focused]);
    expect(f.items.map((item) => item.getExposes().active.get())).toEqual(
      f.items.map((_item, index) => index === focused)
    );
    expect(f.root.getExposes().value.get()).toBe(value);
    expect(f.root.getExposes().open.get()).toBe(true);
  };
  const openAlpha = async (match = false) => {
    const f = sizingFull();
    await settle();
    updatePolicyFixtureProps(f.root, {
      open: true,
      value: 'alpha',
      itemSizing: match ? 'match-trigger' : 'intrinsic',
    });
    await settle();
    assertOwner(f, 0, 'alpha');
    return f;
  };
  it('keeps focused Beta after a Root policy-only real applied round while Alpha stays selected', async () => {
    vi.useFakeTimers();
    facts();
    const f = await openAlpha();
    const events: string[] = [];
    f.root.addEventListener('openChange', () => events.push('open'));
    f.root.addEventListener('valueChange', () => events.push('value'));
    f.items[1].getExposes().focusSelf({ reason: 'keyboard' });
    await settle();
    assertOwner(f, 1, 'alpha');
    expect(f.items[0].style.height).toBe('');
    updatePolicyFixtureProps(f.root, { itemSizing: 'match-trigger' });
    await settle();
    // Used-layout mock facts completed the actual neutral size lease and applied path.
    expect(f.items[0].style.width).toBe('180px');
    expect(f.items[0].style.height).toBe('32px');
    assertOwner(f, 1, 'alpha');
    expect(f.items.map((item) => item.getExposes().selected.get())).toEqual([true, false, false]);
    updatePolicyFixtureProps(f.root, { itemSizing: 'intrinsic' });
    await settle();
    expect(f.items[0].style.height).toBe('');
    assertOwner(f, 1, 'alpha');
    expect(events).toEqual([]);
  });
  it('keeps focused Beta after same-value Item sizing metadata completes a real applied round', async () => {
    vi.useFakeTimers();
    facts();
    const f = await openAlpha(true);
    f.items[1].getExposes().focusSelf({ reason: 'keyboard' });
    await settle();
    updatePolicyFixtureProps(f.items[0], { itemSizing: 'intrinsic' });
    await settle();
    expect(f.items[0].style.height).toBe('');
    expect(f.items[1].style.height).toBe('32px');
    assertOwner(f, 1, 'alpha');
    expect(f.items[0].getExposes().selected.get()).toBe(true);
  });
  it('does not steal an external newer Focus owner during a sizing-only applied refresh', async () => {
    vi.useFakeTimers();
    facts();
    const f = await openAlpha();
    const external = document.createElement('button');
    external.textContent = 'Outside';
    document.body.append(external);
    external.focus();
    await settle();
    expect(document.activeElement).toBe(external);
    updatePolicyFixtureProps(f.root, { itemSizing: 'match-trigger' });
    await settle();
    expect(f.content.getExposes().transitionState.get()).toBe('entered');
    expect(f.items[0].style.height).toBe('32px');
    expect(document.activeElement).toBe(external);
    expect(f.root.getExposes().value.get()).toBe('alpha');
  });
  it('still focuses the selected row on initial matching entry and a genuine value replacement', async () => {
    vi.useFakeTimers();
    facts();
    const f = await openAlpha(true);
    expect(f.items[0].style.height).toBe('32px');
    f.items[1].getExposes().focusSelf({ reason: 'keyboard' });
    await settle();
    updatePolicyFixtureProps(f.root, { value: 'gamma' });
    await settle();
    assertOwner(f, 2, 'gamma');
  });
  it('does not retain a prior-cycle sizing focus exemption across close and reopen', async () => {
    vi.useFakeTimers();
    facts();
    const f = await openAlpha();
    f.items[1].getExposes().focusSelf({ reason: 'keyboard' });
    await settle();
    updatePolicyFixtureProps(f.root, { itemSizing: 'match-trigger' });
    await settle();
    assertOwner(f, 1, 'alpha');
    updatePolicyFixtureProps(f.root, { open: false });
    await settle();
    updatePolicyFixtureProps(f.root, { open: true });
    await settle();
    assertOwner(f, 0, 'alpha');
  });
});

it('retires a pending sizing request when measurement reenters with a second policy', async () => {
  vi.useFakeTimers();
  facts();
  const f = sizingFull();
  await settle();
  updatePolicyFixtureProps(f.root, { open: true, value: 'alpha' });
  await settle();
  expect(document.activeElement).toBe(f.items[0]);
  f.items[1].getExposes().focusSelf({ reason: 'keyboard' });
  await settle();
  let armed = true;
  let replacementCount = 0;
  const before = { ...getElementProps(f.root) };
  const firstWrite = { ...before, itemSizing: 'match-trigger' };
  const finalWrite = { ...before, itemSizing: 'intrinsic' };
  const observedWrites: Record<string, unknown>[] = [];
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    if (this === f.trigger && armed) {
      armed = false;
      replacementCount++;
      observedWrites.push({ ...getElementProps(f.root) });
      expect(observedWrites[0]).toEqual(firstWrite);
      updatePolicyFixtureProps(f.root, { itemSizing: 'intrinsic' });
      observedWrites.push({ ...getElementProps(f.root) });
      expect(observedWrites[1]).toEqual(finalWrite);
    }
    return f.usedWidth(this);
  });
  // This setter deliberately reenters synchronously. Verify each complete
  // authored write at its observation point, not the superseded outer value.
  setElementProps(f.root, firstWrite);
  expect(getElementProps(f.root)).toEqual(finalWrite);
  await settle();
  expect(observedWrites).toEqual([firstWrite, finalWrite]);
  expect(replacementCount).toBe(1);
  expect(f.content.getExposes().alignmentDiagnostic.get()).toBe('');
  expect(f.content.getExposes().transitionState.get()).toBe('entered');
  expect(f.items[0].style.height).toBe('');
  expect(document.activeElement).toBe(f.items[1]);
  expect(f.items.map((item) => item.getExposes().active.get())).toEqual([false, true, false]);
  expect(f.root.getExposes().value.get()).toBe('alpha');
});

it('commits current admission before initial focus reenters with a newer owner and size policy', async () => {
  vi.useFakeTimers();
  facts();
  const f = sizingFull();
  await settle();
  let reentries = 0;
  f.items[0].addEventListener(
    'focus',
    () => {
      reentries++;
      f.items[1].getExposes().focusSelf({ reason: 'keyboard' });
      updatePolicyFixtureProps(f.root, { itemSizing: 'match-trigger' });
    },
    { once: true }
  );
  updatePolicyFixtureProps(f.root, { open: true, value: 'alpha' });
  await settle();
  expect(reentries).toBe(1);
  expect(f.content.getExposes().alignmentDiagnostic.get()).toBe('');
  expect(f.content.getExposes().transitionState.get()).toBe('entered');
  expect(f.items[0].style.height).toBe('32px');
  expect(document.activeElement).toBe(f.items[1]);
  expect(f.items.map((item) => item.getExposes().active.get())).toEqual([false, true, false]);
  expect(f.root.getExposes().value.get()).toBe('alpha');
});

it('does not treat same-scalar ItemText replacement as a sizing-only focus exemption', async () => {
  vi.useFakeTimers();
  facts();
  const f = sizingFull();
  await settle();
  updatePolicyFixtureProps(f.root, { open: true, value: 'alpha', itemSizing: 'match-trigger' });
  await settle();
  f.items[1].getExposes().focusSelf({ reason: 'keyboard' });
  await settle();
  const replacement = document.createElement('base-select-item-text');
  replacement.textContent = 'Alpha';
  f.items[0].replaceChildren(replacement);
  await settle();
  expect(f.items[0].firstElementChild).toBe(replacement);
  expect(f.content.getExposes().alignmentDiagnostic.get()).toBe('');
  expect(f.content.getExposes().transitionState.get()).toBe('entered');
  expect(document.activeElement).toBe(f.items[0]);
  expect(f.root.getExposes().value.get()).toBe('alpha');
});

it('delivers a newer represented value when initial focus synchronously reenters the owner', async () => {
  vi.useFakeTimers();
  facts();
  const f = sizingFull();
  await settle();
  let reentries = 0;
  f.items[0].addEventListener(
    'focus',
    () => {
      reentries++;
      updatePolicyFixtureProps(f.root, { value: 'gamma', itemSizing: 'match-trigger' });
    },
    { once: true }
  );
  updatePolicyFixtureProps(f.root, { open: true, value: 'alpha' });
  await settle();
  expect(reentries).toBe(1);
  expect(f.content.getExposes().alignmentDiagnostic.get()).toBe('');
  expect(f.content.getExposes().transitionState.get()).toBe('entered');
  expect(document.activeElement).toBe(f.items[2]);
  expect(f.root.getExposes().value.get()).toBe('gamma');
  expect(f.items.map((item) => item.getExposes().active.get())).toEqual([false, false, true]);
});

it('does not revive an old sizing focus exemption after a represented value stays pending and returns', async () => {
  vi.useFakeTimers();
  facts();
  const f = sizingFull();
  await settle();
  updatePolicyFixtureProps(f.root, { open: true, value: 'alpha' });
  await settle();
  expect(document.activeElement).toBe(f.items[0]);
  f.items[1].getExposes().focusSelf({ reason: 'keyboard' });
  await settle();
  let pending = true;
  let pendingMeasurements = 0;
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    if (this === f.items[2] && pending) {
      pendingMeasurements++;
      return 0;
    }
    return f.usedHeight(this);
  });
  const events: string[] = [];
  f.root.addEventListener('valueChange', () => events.push('value'));
  f.root.addEventListener('openChange', () => events.push('open'));
  updatePolicyFixtureProps(f.root, { value: 'gamma' });
  await settle();
  expect(pendingMeasurements).toBeGreaterThan(0);
  expect(f.content.getExposes().alignmentDiagnostic.get()).toBe('');
  expect(document.activeElement).toBe(f.items[1]);
  expect(f.root.getExposes().value.get()).toBe('gamma');
  expect(f.items.map((item) => item.getExposes().selected.get())).toEqual([false, false, true]);
  pending = false;
  updatePolicyFixtureProps(f.root, { value: 'alpha', itemSizing: 'match-trigger' });
  await settle();
  expect(f.content.getExposes().transitionState.get()).toBe('entered');
  expect(f.items[0].style.height).toBe('32px');
  expect(document.activeElement).toBe(f.items[0]);
  expect(f.items.map((item) => item.getExposes().active.get())).toEqual([true, false, false]);
  expect(f.items.map((item) => item.getExposes().selected.get())).toEqual([true, false, false]);
  expect(f.root.getExposes().open.get()).toBe(true);
  expect(f.root.getExposes().value.get()).toBe('alpha');
  expect(events).toEqual([]);
});

it('refuses matching when used row width rejects the actual owned sizing write', async () => {
  vi.useFakeTimers();
  facts();
  const f = sizingFull({ refuseUsedWidth: true });
  await settle();
  const events: string[] = [];
  f.root.addEventListener('valueChange', () => events.push('value'));
  f.root.addEventListener('openChange', () => events.push('open'));
  updatePolicyFixtureProps(f.root, { open: true, value: 'alpha', itemSizing: 'match-trigger' });
  await settle();
  expect(f.trigger.offsetWidth).toBe(180);
  expect(f.items[0].offsetWidth).toBe(142);
  expect(f.content.getExposes().alignmentDiagnostic.get()).toBe('select.geometry.size-conflict');
  expect(f.content.getExposes().transitionState.get()).toBe('closed');
  expect(f.items[0].style.width).toBe('');
  expect(document.activeElement).not.toBe(f.items[0]);
  expect(f.root.getExposes().open.get()).toBe(true);
  expect(f.root.getExposes().value.get()).toBe('alpha');
  expect(events).toEqual([]);
});

it('keeps shared Item focus and active ownership while a sizing-only request is pending', async () => {
  vi.useFakeTimers();
  facts();
  const f = sizingFull();
  await settle();
  updatePolicyFixtureProps(f.root, { open: true, value: 'alpha' });
  await settle();
  f.items[1].getExposes().focusSelf({ reason: 'keyboard' });
  await settle();
  const events: string[] = [];
  f.root.addEventListener('openChange', () => events.push('open'));
  f.root.addEventListener('valueChange', () => events.push('value'));
  let pending = true;
  let pendingMeasurements = 0;
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    if (this === f.items[0] && pending) {
      pendingMeasurements++;
      return 0;
    }
    return f.usedHeight(this);
  });
  updatePolicyFixtureProps(f.root, { itemSizing: 'match-trigger' });
  await settle();
  expect(pendingMeasurements).toBeGreaterThan(0);
  expect(document.activeElement).toBe(f.items[1]);
  expect(f.items[1].getExposes().focused.get()).toBe(true);
  expect(f.items.map((item) => item.getExposes().active.get())).toEqual([false, true, false]);
  expect(f.content.getExposes().alignmentDiagnostic.get()).toBe('');
  const external = document.createElement('button');
  document.body.append(external);
  external.focus();
  await settle();
  expect(f.items[1].getExposes().focused.get()).toBe(false);
  expect(f.items.map((item) => item.getExposes().active.get())).toEqual([false, false, false]);
  pending = false;
  updatePolicyFixtureProps(f.root, { itemSizing: 'intrinsic' });
  await settle();
  expect(f.content.getExposes().transitionState.get()).toBe('entered');
  expect(document.activeElement).toBe(external);
  expect(f.items.map((item) => item.getExposes().active.get())).toEqual([false, false, false]);
  expect(f.items[0].style.width).toBe('');
  expect(f.root.getExposes().value.get()).toBe('alpha');
  expect(f.root.getExposes().open.get()).toBe(true);
  expect(events).toEqual([]);
});

it('retires sizing focus continuity on a real geometry abort before policy repair', async () => {
  vi.useFakeTimers();
  facts();
  const f = sizingFull();
  await settle();
  updatePolicyFixtureProps(f.root, { open: true, value: 'alpha' });
  await settle();
  f.items[1].getExposes().focusSelf({ reason: 'keyboard' });
  await settle();
  let refuse = true;
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    return refuse && f.items.some((item) => item === this) ? 142 : f.usedWidth(this);
  });
  const events: string[] = [];
  f.root.addEventListener('openChange', () => events.push('open'));
  f.root.addEventListener('valueChange', () => events.push('value'));
  updatePolicyFixtureProps(f.root, { itemSizing: 'match-trigger' });
  await settle();
  expect(f.content.getExposes().alignmentDiagnostic.get()).toBe('select.geometry.size-conflict');
  expect(f.content.getExposes().transitionState.get()).toBe('closed');
  expect(f.items.map((item) => item.getExposes().focused.get())).toEqual([false, false, false]);
  expect(f.items.map((item) => item.getExposes().active.get())).toEqual([false, false, false]);
  expect(f.items[0].style.width).toBe('');
  refuse = false;
  updatePolicyFixtureProps(f.root, { itemSizing: 'intrinsic' });
  await settle();
  expect(f.content.getExposes().alignmentDiagnostic.get()).toBe('');
  expect(f.content.getExposes().transitionState.get()).toBe('entered');
  expect(document.activeElement).toBe(f.items[0]);
  expect(f.items[0].getExposes().focused.get()).toBe(true);
  expect(f.items.map((item) => item.getExposes().active.get())).toEqual([true, false, false]);
  expect(f.root.getExposes().value.get()).toBe('alpha');
  expect(f.root.getExposes().open.get()).toBe(true);
  expect(events).toEqual([]);
});
