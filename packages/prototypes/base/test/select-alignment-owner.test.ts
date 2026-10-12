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
