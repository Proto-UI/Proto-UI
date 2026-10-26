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
  const root = document.createElement('shadcn-select-root') as WebComponentAdapterElement<
    typeof selectRoot
  >;
  const trigger = document.createElement('shadcn-select-trigger') as WebComponentAdapterElement<
    typeof selectTrigger
  >;
  const value = document.createElement('shadcn-select-value') as WebComponentAdapterElement<
    typeof selectValue
  >;
  const content = document.createElement('shadcn-select-content') as WebComponentAdapterElement<
    typeof selectContent
  >;
  const items = (
    options?.items ?? [
      { value: 'alpha', textValue: 'Alpha' },
      { value: 'beta', textValue: 'Beta' },
      { value: 'gamma', textValue: 'Gamma' },
    ]
  ).map((props) => {
    const item = document.createElement('shadcn-select-item') as WebComponentAdapterElement<
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
    if (this.tagName === 'SHADCN-SELECT-TRIGGER') return box(180, 240, 180, 36);
    if (this.tagName === 'SHADCN-SELECT-VALUE') return box(193, 248, 50, 20);
    if (this.tagName === 'SHADCN-SELECT-SURFACE') return box(0, 0, 180, 106);
    if (this.tagName === 'SHADCN-SELECT-ITEM-TEXT') return box(13, 37, 50, 20);
    return box(0, 0, 180, 32);
  });
  vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    if (this.tagName === 'SHADCN-SELECT-TRIGGER') return 180;
    if (this.tagName === 'SHADCN-SELECT-VALUE') return 193;
    if (this.tagName === 'SHADCN-SELECT-ITEM-TEXT') return 13;
    return 0;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    return this.tagName === 'SHADCN-SELECT-VALUE' || this.tagName === 'SHADCN-SELECT-ITEM-TEXT'
      ? 50
      : 180;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    return this.tagName === 'SHADCN-SELECT-VIEWPORT'
      ? 104
      : this.tagName === 'SHADCN-SELECT-SURFACE'
        ? 106
        : 32;
  });
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(104);
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(104);
  vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    return this.tagName === 'SHADCN-SELECT-ITEM'
      ? 4 + Number(this.getAttribute('data-collection-index')) * 32
      : 0;
  });
}
function full(
  options: { missingText?: boolean; missingSurface?: boolean; controlled?: boolean } = {}
) {
  const f = createSelect({
    root: options.controlled ? { open: false, value: 'beta' } : { defaultValue: 'beta' },
    content: {},
  });
  const surface = document.createElement('shadcn-select-surface'),
    viewport = document.createElement('shadcn-select-viewport');
  surface.style.cssText = 'border:1px solid black;padding:0px;';
  viewport.style.cssText = 'padding:4px;';
  for (const [index, item] of f.items.entries()) {
    item.textContent = '';
    if (!(options.missingText && index === 1)) {
      const text = document.createElement('shadcn-select-item-text');
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
    expect(f.content.getExposes().transitionState.get()).toBe('entering');
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
    const text = document.createElement('shadcn-select-item-text');
    text.textContent = 'Beta';
    f.items[1].append(text);
    await settle();
    expect(f.content.getExposes().transitionState.get()).toBe('entering');
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
    expect(f.content.getExposes().transitionState.get()).toBe('entering');
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
    expect(f.content.getExposes().transitionState.get()).toBe('entering');
    expect(f.content.getExposes().alignmentDiagnostic.get()).toBe('');
  });
});

it('refused controlled Escape during entering preserves visibility, focus and scroll on repeated requests', async () => {
  vi.useFakeTimers();
  facts();
  const f = full({ controlled: true });
  await settle();
  setElementProps(f.root, { open: true, value: 'beta' });
  await settle();
  const changes: unknown[] = [];
  f.root.addEventListener('openChange', (event: Event) =>
    changes.push((event as CustomEvent).detail)
  );
  f.viewport.scrollTop = 37;
  for (let i = 0; i < 2; i++) {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(f.root.getExposes().open.get()).toBe(true);
    expect(f.content.getExposes().transitionState.get()).toBe('entering');
    expect(f.content.hasAttribute('data-pui-view-detached')).toBe(false);
    expect(document.activeElement).toBe(f.items[1]);
    expect(f.viewport.scrollTop).toBe(37);
  }
  expect(changes).toHaveLength(2);
});

it('a real close during entry reaches closed and immediate reopen prepares the latest selected geometry', async () => {
  vi.useFakeTimers();
  facts();
  const f = full({ controlled: true });
  await settle();
  setElementProps(f.root, { open: true, value: 'beta' });
  await settle();
  const phases: string[] = [];
  const stop = f.content.getExposes().transitionState.subscribe((event) => {
    if (event.type === 'next') phases.push(event.next);
  });
  setElementProps(f.root, { open: false, value: 'beta' });
  expect(f.content.getExposes().transitionState.get()).toBe('closed');
  setElementProps(f.root, { open: true, value: 'gamma' });
  await settle();
  expect(phases).toContain('preparing');
  expect(document.activeElement).toBe(f.items[2]);
  await vi.advanceTimersByTimeAsync(200);
  await flush();
  expect(f.content.getExposes().transitionState.get()).toBe('entered');
  expect(document.activeElement).toBe(f.items[2]);
  stop();
});

it('beforeLeave synchronous withdrawal keeps latest open and updates current selected focus', async () => {
  vi.useFakeTimers();
  facts();
  const f = full({ controlled: true });
  await settle();
  setElementProps(f.root, { open: true, value: 'beta' });
  await settle();
  let reversed = false;
  f.content.addEventListener('beforeLeave', () => {
    if (reversed) return;
    reversed = true;
    setElementProps(f.root, { open: true, value: 'gamma' });
  });
  setElementProps(f.root, { open: false, value: 'beta' });
  await settle();
  expect(reversed).toBe(true);
  expect(f.root.getExposes().open.get()).toBe(true);
  expect(f.content.getExposes().transitionState.get()).not.toBe('closed');
  expect(document.activeElement).toBe(f.items[2]);
  await vi.advanceTimersByTimeAsync(200);
  await flush();
  expect(f.content.getExposes().transitionState.get()).toBe('entered');
  expect(document.activeElement).toBe(f.items[2]);
});

it('presentation abort never steals focus already moved outside the Select', async () => {
  vi.useFakeTimers();
  facts();
  const f = full({ controlled: true });
  await settle();
  setElementProps(f.root, { open: true, value: 'beta' });
  await settle();
  const outside = document.createElement('button');
  document.body.append(outside);
  outside.focus();
  setElementProps(f.root, { open: true, value: 'unknown' });
  await settle();
  expect(f.content.getExposes().transitionState.get()).toBe('closed');
  expect(document.activeElement).toBe(outside);
});

it('keyboard navigation and committed item selection use the complete public composition', async () => {
  vi.useFakeTimers();
  facts();
  const f = full();
  await settle();
  f.trigger.focus();
  f.trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  await settle();
  expect(document.activeElement).toBe(f.items[1]);
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
  await flush();
  expect(document.activeElement).toBe(f.items[2]);
  f.items[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await settle();
  expect(f.root.getExposes().value.get()).toBe('gamma');
  expect(f.root.getExposes().open.get()).toBe(false);
  expect(f.content.getExposes().transitionState.get()).toBe('closed');
  expect(document.activeElement).toBe(f.trigger);
});

it('explicit popper with complete parts paints only Surface and retains normal entry focus', async () => {
  vi.useFakeTimers();
  facts();
  const f = full();
  setElementProps(f.content, { position: 'popper' });
  await settle();
  f.trigger.click();
  await settle();
  expect(document.activeElement).toBe(f.items[1]);
  expect(f.content.getAttribute('data-pui-style') ?? '').not.toContain('bg-popover');
  expect(f.surface.getAttribute('data-pui-style') ?? '').toContain('bg-popover');
});

it('a registered selected item becoming disabled invalidates the current request without a silent fallback', async () => {
  vi.useFakeTimers();
  facts();
  const f = full({ controlled: true });
  await settle();
  setElementProps(f.root, { open: true, value: 'beta' });
  await settle();
  setElementProps(f.items[1], { value: 'beta', textValue: 'Beta', disabled: true });
  await settle();
  expect(f.root.getExposes().open.get()).toBe(true);
  expect(f.content.getExposes().transitionState.get()).toBe('closed');
  expect(f.content.getExposes().alignmentDiagnostic.get()).toBe(
    'select.selection.disabled-selected-compatibility'
  );
  setElementProps(f.items[1], { value: 'beta', textValue: 'Beta', disabled: false });
  await settle();
  expect(f.content.getExposes().transitionState.get()).toBe('entering');
  expect(document.activeElement).toBe(f.items[1]);
});

it('identical item metadata refresh neither recenters scroll nor refocuses the selected row', async () => {
  vi.useFakeTimers();
  facts();
  const f = full({ controlled: true });
  await settle();
  setElementProps(f.root, { open: true, value: 'beta' });
  await settle();
  f.viewport.scrollTop = 37;
  const outside = document.createElement('button');
  document.body.append(outside);
  outside.focus();
  for (let i = 0; i < 3; i++) {
    setElementProps(f.items[0], { value: 'alpha', textValue: 'Alpha', disabled: false });
    await settle();
  }
  expect(f.viewport.scrollTop).toBe(37);
  expect(document.activeElement).toBe(outside);
  expect(f.content.getExposes().alignmentDiagnostic.get()).toBe('');
});

it('non-selected duplicate metadata is rejected and fixing it restores the current value', async () => {
  vi.useFakeTimers();
  facts();
  const f = full({ controlled: true });
  await settle();
  setElementProps(f.root, { open: true, value: 'beta' });
  await settle();
  setElementProps(f.items[0], { value: 'gamma', textValue: 'Alpha' });
  await settle();
  expect(f.content.getExposes().alignmentDiagnostic.get()).toBe('select.selection.duplicate-value');
  expect(f.content.getExposes().transitionState.get()).toBe('closed');
  setElementProps(f.items[0], { value: 'alpha', textValue: 'Alpha' });
  await settle();
  expect(f.content.getExposes().alignmentDiagnostic.get()).toBe('');
  expect(document.activeElement).toBe(f.items[1]);
});

it('retiring the current selected item does not generalize the initial first-enabled fallback', async () => {
  vi.useFakeTimers();
  facts();
  const f = full({ controlled: true });
  await settle();
  setElementProps(f.root, { open: true, value: 'beta' });
  await settle();
  f.items[1].remove();
  await settle();
  expect(f.root.getExposes().value.get()).toBe('beta');
  expect(f.content.getExposes().transitionState.get()).toBe('closed');
  expect(f.content.getExposes().alignmentDiagnostic.get()).toBe(
    'select.selection.open-update-compatibility'
  );
});

it('metadata revision cannot unlock an invalid ItemText structure', async () => {
  vi.useFakeTimers();
  facts();
  const f = full({ controlled: true, missingText: true });
  await settle();
  setElementProps(f.root, { open: true, value: 'beta' });
  await settle();
  setElementProps(f.items[1], { value: 'beta', textValue: 'Changed Beta', disabled: false });
  await settle();
  expect(f.content.getExposes().transitionState.get()).toBe('closed');
  expect(f.content.getExposes().alignmentDiagnostic.get()).toBe(
    'select.structure.missing-or-ambiguous-item-text'
  );
});

it('owner disposal from beforeLeave cancels the consumer continuation and old entry work', async () => {
  vi.useFakeTimers();
  facts();
  const f = full();
  await settle();
  f.trigger.click();
  await settle();
  f.content.addEventListener('beforeLeave', () => f.root.remove());
  expect(() => f.root.getExposes().close('dispose')).not.toThrow();
  await vi.advanceTimersByTimeAsync(200);
  await flush();
  expect(f.root.isConnected).toBe(false);
  expect(document.activeElement).not.toBe(f.items[1]);
});

it.each([
  { ready: false, shift: false },
  { ready: false, shift: true },
  { ready: true, shift: false },
  { ready: true, shift: true },
])(
  'Trigger Tab is one controlled request with ready=$ready and shift=$shift',
  async ({ ready, shift }) => {
    vi.useFakeTimers();
    if (ready) facts();
    // Missing host facts retain the cold gate; ready exercises normal entered Content too.
    const f = full({ controlled: true });
    await settle();
    f.trigger.focus();
    setElementProps(f.root, { open: true, value: 'beta' });
    await settle();
    if (ready) {
      await vi.advanceTimersByTimeAsync(150);
      await flush();
      f.trigger.focus();
    }
    expect(f.content.getExposes().transitionState.get()).toBe(ready ? 'entered' : 'preparing');
    const requests: unknown[] = [];
    f.root.addEventListener('openChange', (event: Event) =>
      requests.push((event as CustomEvent).detail)
    );
    const tab = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: shift,
      bubbles: true,
      cancelable: true,
    });
    f.trigger.dispatchEvent(tab);
    await settle();
    expect(requests).toHaveLength(1);
    expect(tab.defaultPrevented).toBe(false);
    expect(f.root.getExposes().open.get()).toBe(true);
    setElementProps(f.root, { open: false, value: 'beta' });
    await settle();
    expect(f.content.getExposes().transitionState.get()).toBe('closed');
  }
);

it.each(['closed', 'disabled'] as const)('Trigger Tab is inert when %s', async (condition) => {
  vi.useFakeTimers();
  facts();
  const f = full({ controlled: true });
  await settle();
  if (condition === 'disabled') {
    setElementProps(f.root, { open: true, value: 'beta' });
    await settle();
    setElementProps(f.trigger, { disabled: true });
  }
  f.trigger.focus();
  const requests: unknown[] = [];
  f.root.addEventListener('openChange', (event: Event) =>
    requests.push((event as CustomEvent).detail)
  );
  const tab = new KeyboardEvent('keydown', {
    key: 'Tab',
    shiftKey: true,
    bubbles: true,
    cancelable: true,
  });
  f.trigger.dispatchEvent(tab);
  await settle();
  expect(requests).toEqual([]);
  expect(tab.defaultPrevented).toBe(false);
});

it('a Trigger Tab callback that synchronously focuses an option cannot submit the same event twice', async () => {
  vi.useFakeTimers();
  facts();
  const f = full({ controlled: true });
  await settle();
  setElementProps(f.root, { open: true, value: 'beta' });
  await settle();
  f.trigger.focus();
  let requests = 0;
  f.root.addEventListener('openChange', () => {
    requests++;
    f.items[1].focus();
  });
  f.trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  await settle();
  expect(requests).toBe(1);
  f.items[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  await settle();
  expect(requests).toBe(2);
});

it('an Item Tab callback that focuses Trigger does not redispatch that event to Trigger', async () => {
  vi.useFakeTimers();
  facts();
  const f = full({ controlled: true });
  await settle();
  setElementProps(f.root, { open: true, value: 'beta' });
  await settle();
  let requests = 0;
  f.root.addEventListener('openChange', () => {
    requests++;
    f.trigger.focus();
  });
  f.items[1].dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })
  );
  await settle();
  expect(requests).toBe(1);
  f.trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  await settle();
  expect(requests).toBe(2);
});

it('cancelled cold entry still reveals applied geometry without stealing focus and resets only after committed close', async () => {
  vi.useFakeTimers();
  const f = full({ controlled: true });
  await settle();
  f.trigger.focus();
  setElementProps(f.root, { open: true, value: 'beta' });
  await settle();
  f.trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  await settle();
  const outside = document.createElement('button');
  document.body.append(outside);
  outside.focus();
  facts();
  const text = document.createElement('shadcn-select-item-text');
  text.textContent = 'Beta';
  f.items[1].replaceChildren(text);
  await settle();
  expect(f.content.getExposes().transitionState.get()).toBe('entering');
  expect(f.content.hasAttribute('data-pui-view-detached')).toBe(false);
  expect(document.activeElement).toBe(outside);
  setElementProps(f.root, { open: false, value: 'beta' });
  await settle();
  setElementProps(f.root, { open: true, value: 'gamma' });
  await settle();
  expect(document.activeElement).toBe(f.items[2]);
});

it('disabling a focused selected option retires its current focus to Trigger', async () => {
  vi.useFakeTimers();
  facts();
  const f = full({ controlled: true });
  await settle();
  setElementProps(f.root, { open: true, value: 'beta' });
  await settle();
  expect(document.activeElement).toBe(f.items[1]);
  setElementProps(f.items[1], { value: 'beta', textValue: 'Beta', disabled: true });
  await settle();
  expect(f.content.getExposes().transitionState.get()).toBe('closed');
  expect(document.activeElement).toBe(f.trigger);
});

it('same-structure metadata retains an already applied unset fallback without choosing another candidate', async () => {
  vi.useFakeTimers();
  facts();
  const f = full({ controlled: true });
  await settle();
  setElementProps(f.root, { open: true, value: '' });
  await settle();
  expect(document.activeElement).toBe(f.items[0]);
  f.viewport.scrollTop = 37;
  setElementProps(f.items[2], { value: 'gamma', textValue: 'New Gamma' });
  await settle();
  expect(f.content.getExposes().alignmentDiagnostic.get()).toBe('');
  expect(f.content.getExposes().transitionState.get()).not.toBe('closed');
  expect(document.activeElement).toBe(f.items[0]);
  expect(f.viewport.scrollTop).toBe(37);
});

it.each(['disabled', 'renamed', 'root-value', 'structure'] as const)(
  'an applied unset fallback cannot survive an invalidating %s change',
  async (change) => {
    vi.useFakeTimers();
    facts();
    const f = full({ controlled: true });
    await settle();
    setElementProps(f.root, { open: true, value: '' });
    await settle();
    expect(document.activeElement).toBe(f.items[0]);
    if (change === 'disabled')
      setElementProps(f.items[0], { value: 'alpha', textValue: 'Alpha', disabled: true });
    if (change === 'renamed') setElementProps(f.items[0], { value: 'other', textValue: 'Other' });
    if (change === 'root-value') setElementProps(f.root, { open: true, value: 'unknown' });
    if (change === 'structure') {
      const text = document.createElement('shadcn-select-item-text');
      text.textContent = 'Alpha';
      f.items[0].replaceChildren(text);
    }
    await settle();
    expect(f.content.getExposes().transitionState.get()).toBe('closed');
    expect(f.content.getExposes().alignmentDiagnostic.get()).not.toBe('');
    expect(document.activeElement).not.toBe(f.items[1]);
  }
);

it.each(['item', 'content', 'root'] as const)(
  'metadata notification may detach %s before deferred owner retirement',
  async (target) => {
    vi.useFakeTimers();
    facts();
    const f = full({ controlled: true });
    await settle();
    setElementProps(f.root, { open: true, value: 'beta' });
    await settle();
    let retired = false;
    f.content.getExposes().alignmentDiagnostic.subscribe((event) => {
      if (event.type === 'next' && event.next && !retired) {
        retired = true;
        if (target === 'item') f.items[1].remove();
        else if (target === 'content') f.content.remove();
        else f.root.remove();
      }
    });
    expect(() =>
      setElementProps(f.items[1], { value: 'beta', textValue: 'Beta', disabled: true })
    ).not.toThrow();
    await settle();
    expect(retired).toBe(true);
    await vi.advanceTimersByTimeAsync(200);
    await flush();
    expect(document.activeElement).not.toBe(f.items[1]);
  }
);

it('Root value roundtrip cannot resurrect a previous initial fallback', async () => {
  vi.useFakeTimers();
  facts();
  const f = full({ controlled: true });
  await settle();
  setElementProps(f.root, { open: true, value: '' });
  await settle();
  expect(document.activeElement).toBe(f.items[0]);
  setElementProps(f.root, { open: true, value: 'beta' });
  await settle();
  expect(document.activeElement).toBe(f.items[1]);
  setElementProps(f.root, { open: true, value: '' });
  await settle();
  expect(f.content.getExposes().transitionState.get()).toBe('closed');
});

it('leaving item-aligned mode invalidates the prior unset fallback', async () => {
  vi.useFakeTimers();
  facts();
  const f = full({ controlled: true });
  await settle();
  setElementProps(f.root, { open: true, value: '' });
  await settle();
  setElementProps(f.content, { position: 'popper' });
  await settle();
  setElementProps(f.content, { position: 'item-aligned' });
  await settle();
  expect(f.content.getExposes().transitionState.get()).toBe('closed');
});

it('item-aligned paint never invents data-side slides or popper translations', async () => {
  vi.useFakeTimers();
  facts();
  const f = full({ controlled: true });
  await settle();
  setElementProps(f.root, { open: true, value: 'beta' });
  await settle();
  for (const side of ['top', 'right', 'bottom', 'left'] as const) {
    setElementProps(f.content, { side });
    await settle();
    const { styleContains } = await import('../../test-utils/style');
    for (const token of [
      'slide-in-from-top-2',
      'slide-in-from-bottom-2',
      'slide-in-from-right-2',
      'slide-in-from-left-2',
      'translate-y-1',
      '-translate-y-1',
      'translate-x-1',
      '-translate-x-1',
    ])
      expect(styleContains(f.surface, token)).toBe(false);
    expect(styleContains(f.surface, 'fade-in-0')).toBe(true);
    expect(styleContains(f.surface, 'zoom-in-95')).toBe(true);
  }
});

it('focus-return reentry preserves the newer open selection', async () => {
  vi.useFakeTimers();
  facts();
  const f = full();
  await settle();
  f.trigger.click();
  await settle();
  expect(document.activeElement).toBe(f.items[1]);
  let returns = 0;
  f.trigger.addEventListener('focus', () => {
    returns += 1;
    if (returns === 1) setElementProps(f.root, { open: true, value: 'gamma' });
  });
  f.root.getExposes().close('escape');
  await settle();
  expect(returns).toBe(1);
  expect(f.root.getExposes().open.get()).toBe(true);
  expect(f.root.getExposes().value.get()).toBe('gamma');
  expect(f.content.getExposes().transitionState.get()).not.toBe('closed');
  expect(document.activeElement).toBe(f.items[2]);
  await vi.advanceTimersByTimeAsync(200);
  await flush();
  expect(f.content.getExposes().transitionState.get()).toBe('entered');
  expect(document.activeElement).toBe(f.items[2]);
});

it('a throwing focus return still leaves the current Select and preserves its error', async () => {
  vi.useFakeTimers();
  facts();
  const f = full();
  await settle();
  f.trigger.click();
  await settle();
  expect(document.activeElement).toBe(f.items[1]);
  const failure = new Error('focus-return host failure');
  const focus = vi.spyOn(f.trigger, 'focus').mockImplementation(() => {
    throw failure;
  });
  let caught: unknown;
  let threw = false;
  try {
    f.root.getExposes().close('escape');
  } catch (error) {
    threw = true;
    caught = error;
  } finally {
    focus.mockRestore();
  }
  expect(threw).toBe(true);
  expect(caught).toBe(failure);
  expect(f.root.getExposes().open.get()).toBe(false);
  await settle();
  expect(f.content.getExposes().transitionState.get()).toBe('closed');
});

it('preparing focus-return reentry preserves the newer open request', async () => {
  vi.useFakeTimers();
  const f = full();
  await settle();
  f.trigger.click();
  await settle();
  // No geometry facts or private admission flags: retain the actual cold phase.
  expect(f.content.getExposes().transitionState.get()).toBe('preparing');
  f.items[1].focus();
  expect(document.activeElement).toBe(f.items[1]);
  let returns = 0;
  f.trigger.addEventListener('focus', () => {
    returns += 1;
    if (returns === 1) setElementProps(f.root, { open: true, value: 'gamma' });
  });
  f.root.getExposes().close('escape');
  await settle();
  expect(returns).toBe(1);
  expect(f.root.getExposes().open.get()).toBe(true);
  expect(f.root.getExposes().value.get()).toBe('gamma');
  expect(f.content.getExposes().transitionState.get()).toBe('preparing');
  expect(document.activeElement).toBe(f.trigger);
});

it('a throwing preparing focus return still closes the current Select', async () => {
  vi.useFakeTimers();
  const f = full();
  await settle();
  f.trigger.click();
  await settle();
  expect(f.content.getExposes().transitionState.get()).toBe('preparing');
  f.items[1].focus();
  expect(document.activeElement).toBe(f.items[1]);
  const failure = new Error('preparing focus-return host failure');
  const focus = vi.spyOn(f.trigger, 'focus').mockImplementation(() => {
    throw failure;
  });
  let caught: unknown;
  let threw = false;
  try {
    f.root.getExposes().close('escape');
  } catch (error) {
    threw = true;
    caught = error;
  } finally {
    focus.mockRestore();
  }
  expect(threw).toBe(true);
  expect(caught).toBe(failure);
  expect(f.root.getExposes().open.get()).toBe(false);
  await settle();
  expect(f.content.getExposes().transitionState.get()).toBe('closed');
});
