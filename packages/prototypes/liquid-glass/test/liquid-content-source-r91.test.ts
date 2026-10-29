import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prototype } from '@proto.ui/core';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import type { VisualFeedbackFrame } from '@proto.ui/module-feedback';
import * as scrollArea from '../src/scroll-area';
import * as table from '../src/data-table';
import * as tree from '../src/tree';
import * as resize from '../src/resizable';
import * as carousel from '../src/carousel';
import * as virtual from '../src/virtual-list';
import * as messages from '../src/message-scroller';
import * as progress from '../src/progress';
import * as meter from '../src/meter';
import * as calendar from '../src/calendar';
import * as datePicker from '../src/date-picker';
import * as checkbox from '../src/checkbox-group';
import * as otp from '../src/input-otp';
import * as number from '../src/number-field';
import * as form from '../src/form';
import * as field from '../src/field';
import * as slider from '../src/slider';
import * as toolbar from '../src/toolbar';
import * as toggleGroup from '../src/toggle-group';
import textRoot from '../src/text';

// These are real runtime/Adapter observations with bounded synthetic geometry.
// A recording sink observes submitted intent, not a material provider or paint.
// No Apple implementation, native input, optical or motion acceptance is implied.
type Subject = HTMLElement & { getExposes(): Record<string, any> };
const frames = new WeakMap<HTMLElement, VisualFeedbackFrame[]>();
const releases = new WeakMap<HTMLElement, number>();
const registered = new Set<string>();
function make(
  prototype: Prototype<any, any>,
  props: Record<string, unknown> = {},
  options: { scrollProjection?: 'auto' | 'system' | 'composed'; shadow?: boolean } = {}
): Subject {
  const tag = `content-r91-${options.scrollProjection ?? 'auto'}-${options.shadow ? 'shadow' : 'light'}-${prototype.name}`;
  if (!registered.has(tag)) {
    AdaptToWebComponent(prototype, {
      registerAs: tag,
      shadow: false,
      ...options,
      createVisualSink(host, effects) {
        const records: VisualFeedbackFrame[] = [];
        frames.set(host, records);
        return {
          commit(frame) {
            records.push(frame);
            effects.queueStyle({ ...frame.style, tokens: [...frame.style.tokens] });
            effects.requestFlush();
          },
          release() {
            releases.set(host, (releases.get(host) ?? 0) + 1);
          },
        };
      },
    });
    registered.add(tag);
  }
  const element = document.createElement(tag) as Subject;
  setElementProps(element, props);
  return element;
}
async function flush(): Promise<void> {
  for (let index = 0; index < 30; index++) await Promise.resolve();
  await vi.runOnlyPendingTimersAsync();
  for (let index = 0; index < 30; index++) await Promise.resolve();
}
function latest(element: HTMLElement): VisualFeedbackFrame {
  const frame = frames.get(element)?.at(-1);
  if (!frame) throw new Error(`Missing feedback frame for ${element.localName}`);
  return frame;
}
function expectNeutral(...elements: HTMLElement[]): void {
  for (const element of elements) {
    expect(latest(element).material).toEqual({ slot: null, candidates: [] });
  }
}
function metrics(
  target: HTMLElement,
  width = 100,
  height = 100,
  contentWidth = 400,
  contentHeight = 400
) {
  Object.defineProperties(target, {
    clientWidth: { configurable: true, value: width },
    scrollWidth: { configurable: true, value: contentWidth },
    clientHeight: { configurable: true, value: height },
    scrollHeight: { configurable: true, value: contentHeight },
    scrollLeft: { configurable: true, writable: true, value: 0 },
    scrollTop: { configurable: true, writable: true, value: 0 },
  });
}
const pointer = (type: string, overrides: PointerEventInit = {}) =>
  new PointerEvent(type, {
    bubbles: true,
    composed: true,
    cancelable: true,
    pointerId: 7,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    clientX: 60,
    clientY: 5,
    ...overrides,
  });
const click = (element: HTMLElement) =>
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('Liquid content: inherited Scroll Area sessions, not a glass container', () => {
  it('keeps auto/system projection, the actual slot and dynamic navigation on the Viewport', async () => {
    const root = make(scrollArea.scrollAreaRoot);
    const viewport = make(scrollArea.scrollAreaViewport);
    const track = make(scrollArea.scrollAreaScrollbar);
    const thumb = make(scrollArea.scrollAreaThumb);
    const content = document.createElement('p');
    content.textContent = 'Ordinary scrollable content';
    metrics(viewport, 200, 100, 500, 400);
    viewport.append(content);
    track.append(thumb);
    root.append(viewport, track);
    document.body.append(root);
    await flush();

    const facts = viewport.getExposes();
    expect(facts.scrollAxes.get()).toBe('both');
    expect(facts.scrollProjection.get()).toBe('system');
    expect(facts.scrollXVisibleRatio.get()).toBe(0.4);
    expect(facts.scrollYVisibleRatio.get()).toBe(0.25);
    expect(viewport.tabIndex).toBe(0);
    expect(viewport.getAttribute('role')).toBeNull();
    expect(root.contains(content)).toBe(true);
    expect(track.style.display).toBe('none');
    expect(thumb.tabIndex).toBe(-1);
    expectNeutral(root, viewport, track, thumb);

    viewport.scrollTop = 150;
    viewport.dispatchEvent(new Event('scroll'));
    await flush();
    expect(facts.scrollYPosition.get()).toBe(0.5);
    setElementProps(track, { orientation: 'horizontal' });
    await flush();
    expect(track.getExposes().orientation.get()).toBe('horizontal');
    expect(latest(track).style.tokens).toContain('h-2.5');
    expect(latest(track).style.tokens).not.toContain('w-2.5');
    setElementProps(track, {});
    metrics(viewport, 200, 100, 200, 100);
    viewport.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('resize'));
    await flush();
    expect(track.getExposes().orientation.get()).toBe('vertical');
    expect(latest(track).style.tokens).not.toContain('h-2.5');
    expect(facts.canScrollDown.get()).toBe(false);
    expect(viewport.tabIndex).toBe(-1);
    expect(root.contains(content)).toBe(true);
    root.remove();
    await flush();
    expect(releases.get(viewport)).toBeGreaterThan(0);
  });

  it('lets a composed-preferring host own two-axis dragging, replacement and retirement', async () => {
    const root = make(scrollArea.scrollAreaRoot);
    const viewport = make(scrollArea.scrollAreaViewport, {}, { scrollProjection: 'composed' });
    const vertical = make(scrollArea.scrollAreaScrollbar);
    const horizontal = make(scrollArea.scrollAreaScrollbar, { orientation: 'horizontal' });
    const verticalThumb = make(scrollArea.scrollAreaThumb);
    const horizontalThumb = make(scrollArea.scrollAreaThumb);
    metrics(viewport);
    Object.defineProperty(vertical, 'clientHeight', { configurable: true, value: 100 });
    Object.defineProperty(horizontal, 'clientWidth', { configurable: true, value: 100 });
    vertical.getBoundingClientRect = () => new DOMRect(90, 0, 10, 100);
    horizontal.getBoundingClientRect = () => new DOMRect(0, 90, 100, 10);
    verticalThumb.getBoundingClientRect = () => new DOMRect(90, 0, 10, 25);
    horizontalThumb.getBoundingClientRect = () => new DOMRect(0, 90, 25, 10);
    vertical.append(verticalThumb);
    horizontal.append(horizontalThumb);
    root.append(viewport, vertical, horizontal);
    document.body.append(root);
    await flush();
    expect(viewport.getExposes().scrollProjection.get()).toBe('composed');
    expect(verticalThumb.style.getPropertyValue('--proto-ui-scroll-thumb-size')).toBe('25px');
    expect(horizontalThumb.style.getPropertyValue('--proto-ui-scroll-thumb-size')).toBe('25px');

    verticalThumb.dispatchEvent(pointer('pointerdown', { isPrimary: false }));
    verticalThumb.dispatchEvent(pointer('pointermove', { isPrimary: false, clientY: 45 }));
    expect(viewport.scrollTop).toBe(0);
    verticalThumb.dispatchEvent(pointer('pointerdown'));
    verticalThumb.dispatchEvent(pointer('pointermove', { pointerId: 8, clientY: 45 }));
    expect(viewport.scrollTop).toBe(0);
    verticalThumb.dispatchEvent(pointer('pointermove', { clientY: 45 }));
    verticalThumb.dispatchEvent(pointer('pointerup', { clientY: 45 }));
    expect(viewport.scrollTop).toBeGreaterThan(0);
    horizontalThumb.dispatchEvent(pointer('pointerdown', { clientX: 5 }));
    horizontalThumb.dispatchEvent(pointer('pointermove', { clientX: 45 }));
    horizontalThumb.dispatchEvent(pointer('pointerup', { clientX: 45 }));
    expect(viewport.scrollLeft).toBeGreaterThan(0);

    viewport.scrollTop = 0;
    const replacement = make(scrollArea.scrollAreaThumb);
    replacement.getBoundingClientRect = () => new DOMRect(90, 0, 10, 25);
    verticalThumb.replaceWith(replacement);
    await flush();
    verticalThumb.dispatchEvent(pointer('pointerdown'));
    verticalThumb.dispatchEvent(pointer('pointermove', { clientY: 45 }));
    verticalThumb.dispatchEvent(pointer('pointerup', { clientY: 45 }));
    expect(viewport.scrollTop).toBe(0);
    replacement.dispatchEvent(pointer('pointerdown'));
    replacement.dispatchEvent(pointer('pointermove', { clientY: 45 }));
    replacement.dispatchEvent(pointer('pointerup', { clientY: 45 }));
    expect(viewport.scrollTop).toBeGreaterThan(0);
    expectNeutral(root, viewport, vertical, horizontal, replacement, horizontalThumb);
    root.remove();
    await flush();
    const retiredOffset = viewport.scrollTop;
    replacement.dispatchEvent(pointer('pointerdown'));
    replacement.dispatchEvent(pointer('pointermove', { clientY: 80 }));
    replacement.dispatchEvent(pointer('pointerup', { clientY: 80 }));
    expect(viewport.scrollTop).toBe(retiredOffset);
  });
});

describe('Liquid content: data and collection ownership survives neutral paint', () => {
  it('keeps passive HeaderRow, controlled sort/selection refusal and computed cell rendering', async () => {
    const rows = [
      { id: 'a', name: 'Zeta' },
      { id: 'b', name: 'Alpha' },
    ];
    const root = make(table.dataTableRoot, {
      rows,
      pageSize: 2,
      sortKey: '',
      sortDirection: 'none',
      selectedKeys: [],
    });
    const head = make(table.dataTableHeaderRow);
    const header = make(table.dataTableHeader, { headerKey: 'name' });
    header.textContent = 'Name';
    head.append(header);
    const body = [0, 1].map((index) => {
      const row = make(table.dataTableRow, { index });
      const cell = make(table.dataTableCell, { columnKey: 'name', headers: ['name'] });
      row.append(cell);
      return { row, cell };
    });
    root.append(head, ...body.map(({ row }) => row));
    const sortRequests: unknown[] = [];
    const selections: unknown[] = [];
    root.addEventListener('sortChange', (event) =>
      sortRequests.push((event as CustomEvent).detail)
    );
    root.addEventListener('selectionChange', (event) =>
      selections.push((event as CustomEvent).detail)
    );
    document.body.append(root);
    await flush();
    expect(root.getExposes().getStructure()).toMatchObject({
      valid: true,
      rowCount: 3,
      columnCount: 1,
    });
    expect(body[0]!.cell.textContent).toBe('Zeta');
    expect(head.tabIndex).toBe(-1);
    expect(head.getAttribute('aria-selected')).toBeNull();
    click(head);
    click(header);
    click(body[0]!.row);
    await flush();
    expect(sortRequests).toEqual([{ sortKey: 'name', sortDirection: 'ascending' }]);
    expect(selections).toEqual([{ selectedKeys: ['a'] }]);
    expect(header.getAttribute('aria-sort')).toBe('none');
    expect(body[0]!.row.getExposes().selected.get()).toBe(false);
    expect(body[0]!.cell.textContent).toBe('Zeta');
    setElementProps(root, {
      rows,
      pageSize: 2,
      sortKey: 'name',
      sortDirection: 'ascending',
      selectedKeys: ['b'],
    });
    await flush();
    expect(body[0]!.cell.textContent).toBe('Alpha');
    expect(body[0]!.row.getExposes().selected.get()).toBe(true);
    expect(latest(body[0]!.cell).style.tokens).toContain('text-inherit');
    expect(latest(body[0]!.row).style.tokens).toContain('text-primary-foreground');
    expect(header.getAttribute('aria-sort')).toBe('ascending');
    expectNeutral(root, head, header, ...body.flatMap(({ row, cell }) => [row, cell]));
  });

  it('keeps controlled Tree expansion distinct from selection and preserves authored labels', async () => {
    const root = make(tree.treeRoot, { value: 'a', expandedKeys: [] });
    const a = make(tree.treeItem, { nodeKey: 'a' });
    const group = make(tree.treeGroup, { nodeKey: 'a' });
    const b = make(tree.treeItem, { nodeKey: 'b', parentKey: 'a' });
    const toggle = make(tree.treeToggle, { nodeKey: 'a' });
    a.textContent = 'Parent';
    b.textContent = 'Child';
    toggle.textContent = 'Expand';
    group.append(b);
    root.append(a, toggle, group);
    document.body.append(root);
    await flush();
    const requests: unknown[] = [];
    root.addEventListener('expandedChange', (event) =>
      requests.push((event as CustomEvent).detail)
    );
    click(toggle);
    await flush();
    expect(requests).toEqual([{ expandedKeys: ['a'] }]);
    expect(root.getExposes().getExpandedKeys()).toEqual([]);
    expect(b.getExposes().hidden.get()).toBe(true);
    setElementProps(root, { value: 'a', expandedKeys: ['a'] });
    await flush();
    click(b);
    await flush();
    expect(root.getExposes().value.get()).toBe('a');
    expect(b.getAttribute('aria-level')).toBe('2');
    expect(b.textContent).toBe('Child');
    setElementProps(root, { value: 'b', expandedKeys: ['a'] });
    await flush();
    expect(b.getExposes().selected.get()).toBe(true);
    expectNeutral(root, a, group, b, toggle);
  });

  it('preserves controlled Resizable ratios and accepted owner updates without glass panels', async () => {
    const root = make(resize.resizableRoot, { value: 40 });
    const first = make(resize.resizablePanel, { index: 0 });
    const second = make(resize.resizablePanel, { index: 1 });
    const handle = make(resize.resizableHandle);
    first.textContent = 'Primary content';
    second.textContent = 'Inspector content';
    root.append(first, handle, second);
    document.body.append(root);
    await flush();
    const requests: unknown[] = [];
    root.addEventListener('valueChange', (event) => requests.push((event as CustomEvent).detail));
    expect(root.getExposes().requestValue(65)).toBe(true);
    await flush();
    expect(requests).toEqual([{ value: 65 }]);
    expect(root.getExposes().value.get()).toBe(40);
    expect(second.getExposes().size.get()).toBe(60);
    setElementProps(root, { value: 65, orientation: 'vertical' });
    await flush();
    expect(first.getExposes().size.get()).toBe(65);
    expect(second.getExposes().size.get()).toBe(35);
    expect(second.textContent).toBe('Inspector content');
    expectNeutral(root, first, second, handle);
  });

  it('keeps Carousel index controlled and slide visibility Base-owned, without autoplay', async () => {
    const root = make(carousel.carouselRoot, { index: 0 });
    const viewport = make(carousel.carouselViewport);
    const first = make(carousel.carouselSlide, { index: 0 });
    const second = make(carousel.carouselSlide, { index: 1 });
    const next = make(carousel.carouselNext);
    first.textContent = 'First scene';
    second.textContent = 'Second scene';
    next.textContent = 'Next';
    viewport.append(first, second);
    root.append(viewport, next);
    const requests: unknown[] = [];
    root.addEventListener('indexChange', (event) => requests.push((event as CustomEvent).detail));
    document.body.append(root);
    await flush();
    click(next);
    await flush();
    expect(requests).toEqual([{ index: 1 }]);
    expect(root.getExposes().index.get()).toBe(0);
    expect(second.getExposes().hidden.get()).toBe(true);
    setElementProps(root, { index: 1 });
    await flush();
    expect(first.getExposes().hidden.get()).toBe(true);
    expect(second.getExposes().hidden.get()).toBe(false);
    expect(second.textContent).toBe('Second scene');
    expectNeutral(root, viewport, first, second, next);
  });

  it('retains the complete Virtual List collection and rejects stale bounded work after owner changes', async () => {
    const root = make(virtual.virtualListRoot, {
      itemKeys: ['a', 'b', 'c'],
      overscanItems: 0,
      maxMaterializedItems: 2,
    });
    const viewport = make(virtual.virtualListViewport);
    const content = make(virtual.virtualListContent);
    const authored = document.createElement('span');
    authored.textContent = 'Consumer content';
    content.append(authored);
    viewport.append(content);
    root.append(viewport);
    metrics(viewport);
    document.body.append(root);
    await flush();
    const collection = root.getExposes().getCollection();
    const stale = collection.propose(0, 2);
    expect(stale.keys).toEqual(['a', 'b']);
    setElementProps(root, { itemKeys: ['x', 'b', 'c'], overscanItems: 0, maxMaterializedItems: 2 });
    await flush();
    expect(collection.commit(stale, stale.keys)).toBe(false);
    expect(root.getExposes().logicalCount.get()).toBe(3);
    expect(root.getExposes().getWindow().keys).toEqual(['x', 'b', 'c']);
    expect(content.querySelector('span')).toBe(authored);
    expect(viewport.getExposes().scrollProjection.get()).toBe('system');
    expectNeutral(root, viewport, content);
    root.remove();
    await flush();
    expect(collection.snapshot().committed).toBeNull();
  });

  it('retains the Message Scroller surface and current message facts across retirement', async () => {
    const root = make(messages.messageScrollerRoot, { newContentCount: 3 });
    const viewport = make(messages.messageScrollerViewport);
    const jump = make(messages.messageScrollerJump);
    const payload = document.createElement('p');
    payload.textContent = 'Message payload';
    metrics(viewport);
    viewport.append(payload);
    jump.textContent = 'Jump to latest';
    root.append(viewport, jump);
    document.body.append(root);
    await flush();
    expect(viewport.getExposes().scrollAxes.get()).toBe('vertical');
    expect(viewport.getExposes().canScrollDown.get()).toBe(true);
    expect(jump.getExposes().newContentCount.get()).toBe(3);
    setElementProps(root, { newContentCount: 7 });
    await flush();
    expect(jump.getExposes().newContentCount.get()).toBe(7);
    expect(viewport.querySelector('p')).toBe(payload);
    expectNeutral(root, viewport, jump);
    root.remove();
    await flush();
    expect(releases.get(viewport)).toBeGreaterThan(0);
    document.body.append(root);
    await flush();
    expect(jump.getExposes().newContentCount.get()).toBe(7);
    expect(viewport.getExposes().scrollAxes.get()).toBe('vertical');
    expectNeutral(root, viewport, jump);
  });
});

describe('Liquid content: passive facts, date rendering and ordinary editors', () => {
  it('keeps Progress indeterminate withdrawal distinct from Meter critical status', async () => {
    const progressRoot = make(progress.progressRoot);
    const progressTrack = make(progress.progressTrack);
    const progressIndicator = make(progress.progressIndicator);
    const progressValue = make(progress.progressValue);
    progressTrack.append(progressIndicator);
    progressRoot.append(progressTrack, progressValue);
    const meterRoot = make(meter.meterRoot, {
      value: 90,
      min: 0,
      max: 100,
      low: 25,
      high: 75,
      optimum: 10,
    });
    const meterTrack = make(meter.meterTrack);
    const meterIndicator = make(meter.meterIndicator);
    const meterValue = make(meter.meterValue);
    meterTrack.append(meterIndicator);
    meterRoot.append(meterTrack, meterValue);
    document.body.append(progressRoot, meterRoot);
    await flush();
    expect(progressRoot.getAttribute('role')).toBe('progressbar');
    expect(progressRoot.hasAttribute('aria-valuenow')).toBe(false);
    expect(latest(progressIndicator).style.tokens).toContain('w-1/3');
    expect(meterRoot.getAttribute('role')).toBe('meter');
    expect(meterIndicator.getExposes().status.get()).toBe('critical');
    expect(latest(meterIndicator).style.tokens).toContain('bg-destructive');
    setElementProps(progressRoot, { value: 50, valueText: 'Half complete' });
    setElementProps(meterRoot, { value: 10, min: 0, max: 100, low: 25, high: 75, optimum: 10 });
    await flush();
    expect(progressValue.textContent).toBe('Half complete');
    expect(progressRoot.getAttribute('aria-valuenow')).toBe('50');
    expect(latest(progressIndicator).style.tokens).not.toContain('w-1/3');
    expect(meterIndicator.getExposes().status.get()).toBe('optimal');
    expect(latest(meterIndicator).style.tokens).not.toContain('bg-destructive');
    expectNeutral(
      progressRoot,
      progressTrack,
      progressIndicator,
      progressValue,
      meterRoot,
      meterTrack,
      meterIndicator,
      meterValue
    );
  });

  it('preserves Calendar computed days, heading and controlled refusal without a nested material owner', async () => {
    const props = { month: '2026-10', value: '2026-10-09', locale: 'en-US', direction: 'rtl' };
    const root = make(calendar.calendarRoot, props);
    const caption = make(calendar.calendarCaption);
    const heading = make(calendar.calendarHeading);
    const grid = make(calendar.calendarGrid);
    const row = make(calendar.calendarRow, { index: 0 });
    const day = make(calendar.calendarDay, { date: '2026-10-10' });
    day.textContent = 'Not the computed date';
    caption.append(heading);
    row.append(day);
    grid.append(row);
    root.append(caption, grid);
    const proposals: unknown[] = [];
    root.addEventListener('valueChange', (event) => proposals.push((event as CustomEvent).detail));
    document.body.append(root);
    await flush();
    expect(heading.textContent).toContain('October');
    expect(day.textContent).toBe('10');
    expect(latest(root).style.tokens).toContain('direction-rtl');
    click(day);
    await flush();
    expect(proposals).toEqual([{ value: '2026-10-10' }]);
    expect(root.getExposes().value.get()).toBe('2026-10-09');
    expect(day.getExposes().selected.get()).toBe(false);
    setElementProps(root, { ...props, value: '2026-10-10', direction: 'ltr' });
    await flush();
    expect(day.getExposes().selected.get()).toBe(true);
    expect(latest(root).style.tokens).not.toContain('direction-rtl');
    expectNeutral(root, caption, heading, grid, row, day);
  });

  it('gives DatePicker Content the sole open-gated material while preserving inherited date/value renderers', async () => {
    const props = { open: true, month: '2026-10', value: '2026-10-09' };
    const root = make(datePicker.datePickerRoot, props);
    const trigger = make(datePicker.datePickerTrigger);
    const value = make(datePicker.datePickerValue);
    const content = make(datePicker.datePickerContent, { enterDuration: 0, leaveDuration: 0 });
    const day = make(datePicker.datePickerDay, { date: '2026-10-10' });
    trigger.append(value);
    content.append(day);
    root.append(trigger, content);
    document.body.append(root);
    await flush();
    expect(value.textContent).toBe('2026-10-09');
    expect(day.textContent).toBe('10');
    expectNeutral(root, trigger, value, day);
    expect(latest(content).material.candidates).toEqual([
      { intent: 'liquid-glass', variant: 'regular' },
    ]);
    expect(latest(content).style.tokens).toEqual(
      expect.arrayContaining(['bg-secondary', 'text-secondary-foreground'])
    );
    click(day);
    await flush();
    expect(root.getExposes().value.get()).toBe('2026-10-09');
    expect(root.getExposes().open.get()).toBe(true);
    setElementProps(root, { ...props, open: false });
    await flush();
    expect(latest(content).material.candidates).toEqual([]);
  });

  it('preserves mixed/checked Checkbox Group glyphs, one request and slotted labels without material', async () => {
    const root = make(checkbox.checkboxGroupRoot, { value: ['a'] });
    const all = make(checkbox.checkboxGroupAll);
    const a = make(checkbox.checkboxGroupItem, { value: 'a' });
    const b = make(checkbox.checkboxGroupItem, { value: 'b' });
    a.textContent = 'Email';
    b.textContent = 'Messages';
    all.textContent = 'All';
    root.append(all, a, b);
    document.body.append(root);
    await flush();
    expect(all.getAttribute('aria-checked')).toBe('mixed');
    expect(all.querySelector('svg path')?.getAttribute('d')).toBe('M5 12h14');
    expect(a.querySelector('svg path')?.getAttribute('d')).toBe('m20 6-11 11-5-5');
    expect(b.querySelector('svg path')).toBeNull();
    const proposals: unknown[] = [];
    root.addEventListener('valueChange', (event) => proposals.push((event as CustomEvent).detail));
    click(b);
    await flush();
    expect(proposals).toEqual([{ value: ['a', 'b'] }]);
    expect(b.querySelector('svg path')).toBeNull();
    setElementProps(root, { value: ['a', 'b'] });
    await flush();
    expect(all.getAttribute('aria-checked')).toBe('true');
    expect(b.querySelector('svg path')?.getAttribute('d')).toBe('m20 6-11 11-5-5');
    expect(b.textContent).toBe('Messages');
    expectNeutral(root, all, a, b);
  });

  it('keeps one controlled OTP editor and passive character slots, including owner refusal', async () => {
    const root = make(otp.inputOtpRoot, { value: '12', length: 4 });
    const input = make(otp.inputOtpInput);
    const slots = [0, 1, 2, 3].map((index) => make(otp.inputOtpSlot, { index }));
    root.append(input, ...slots);
    document.body.append(root);
    await flush();
    const editor = input.querySelector('input')!;
    expect(root.querySelectorAll('input,textarea')).toHaveLength(1);
    expect(editor.value).toBe('12');
    expect(slots.map((slot) => slot.textContent)).toEqual(['1', '2', '', '']);
    const proposals: unknown[] = [];
    root.addEventListener('valueChange', (event) => proposals.push((event as CustomEvent).detail));
    editor.value = '12a345';
    editor.dispatchEvent(
      new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText' })
    );
    await flush();
    expect(proposals).toEqual([{ value: '1234' }]);
    expect(editor.value).toBe('12');
    setElementProps(root, { value: '1234', length: 4 });
    await flush();
    expect(root.getExposes().complete.get()).toBe(true);
    expect(slots.map((slot) => slot.textContent)).toEqual(['1', '2', '3', '4']);
    expect(input.querySelector('input')).toBe(editor);
    expectNeutral(root, input, ...slots);
  });

  it('preserves the NumberField draft and actual editor when owner updates are unrelated', async () => {
    const root = make(number.numberFieldRoot, { value: 2 });
    const input = make(number.numberFieldInput);
    const increment = make(number.numberFieldIncrement);
    const decrement = make(number.numberFieldDecrement);
    increment.textContent = '+';
    decrement.textContent = '-';
    root.append(decrement, input, increment);
    document.body.append(root);
    await flush();
    const editor = input.querySelector('input')!;
    editor.focus();
    editor.value = '-';
    editor.dispatchEvent(
      new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText' })
    );
    setElementProps(root, { value: 2, ariaLabel: 'Quantity' });
    await flush();
    expect(editor.value).toBe('-');
    expect(root.getExposes().value.get()).toBe(2);
    setElementProps(root, { value: 5 });
    await flush();
    expect(input.querySelector('input')).toBe(editor);
    expect(root.querySelectorAll('input,textarea')).toHaveLength(1);
    expect(editor.value).toBe('5');
    expectNeutral(root, input, increment, decrement);
  });

  it('retains Field-bound OTP/Number editors, typed Form serialization and the real Reset action', async () => {
    const root = make(form.formRoot);
    const reset = make(form.formReset, { material: 'opaque' });
    reset.textContent = 'Reset';
    const numberRoot = make(number.numberFieldRoot, { defaultValue: 2 });
    const numberControl = make(number.numberFieldControl);
    numberRoot.append(numberControl);
    const otpRoot = make(otp.inputOtpRoot, { defaultValue: '12' });
    const otpControl = make(otp.inputOtpControl);
    otpRoot.append(otpControl);
    for (const [name, control] of [
      ['quantity', numberRoot],
      ['code', otpRoot],
    ] as const) {
      const owner = make(form.formField, { name });
      const label = make(field.fieldLabel);
      label.textContent = name;
      owner.append(label, control);
      root.append(owner);
    }
    root.append(reset);
    document.body.append(root);
    await flush();
    expect(root.getExposes().getValues()).toEqual({ quantity: 2, code: '12' });
    expect(numberControl.querySelectorAll('input,textarea')).toHaveLength(1);
    expect(otpControl.querySelectorAll('input,textarea')).toHaveLength(1);
    expect(numberControl.querySelector('input')!.getAttribute('aria-labelledby')).toBeTruthy();
    numberRoot.getExposes().requestValue(6);
    otpRoot.getExposes().requestValue('3456');
    await flush();
    expect(root.getExposes().getValues()).toEqual({ quantity: 6, code: '3456' });
    click(reset);
    await flush();
    expect(root.getExposes().getValues()).toEqual({ quantity: 2, code: '12' });
    expectNeutral(root, numberRoot, numberControl, otpRoot, otpControl);
    expect(latest(reset).material.candidates).toEqual([]);
  });

  it('preserves the explicitly governed static Field editor candidate and readable disabled fallback', async () => {
    const root = make(field.fieldRoot, { disabled: true });
    const control = make(field.fieldControl);
    const label = make(field.fieldLabel);
    label.textContent = 'Governed editor';
    root.append(label, control);
    document.body.append(root);
    await flush();
    const editor = control.querySelector('input')!;
    expect(editor.disabled).toBe(true);
    expect(control.querySelectorAll('input,textarea')).toHaveLength(1);
    expect(latest(control).material.candidates).toEqual([{ intent: 'liquid-glass' }]);
    expect(latest(control).style.tokens).toEqual(
      expect.arrayContaining(['bg-background', 'text-foreground'])
    );
    expect(latest(control).style.tokens.some((token) => token.startsWith('opacity-'))).toBe(false);
    expectNeutral(root, label);
  });

  it('preserves Toolbar Separator empty rendering and cross-axis withdrawal without another control', async () => {
    const root = make(toolbar.toolbarRoot);
    const button = make(toolbar.toolbarButton);
    const separator = make(toolbar.toolbarSeparator, {}, { shadow: true });
    const neverRendered = document.createElement('span');
    neverRendered.textContent = 'Not separator content';
    separator.append(neverRendered);
    button.textContent = 'Action';
    root.append(button, separator);
    document.body.append(root);
    await flush();
    expect(separator.getAttribute('role')).toBe('separator');
    expect(separator.getAttribute('aria-orientation')).toBe('vertical');
    expect(separator.shadowRoot).not.toBeNull();
    expect(separator.shadowRoot!.querySelector('slot')).toBeNull();
    expect(separator.shadowRoot!.textContent).not.toContain('Not separator content');
    setElementProps(root, { orientation: 'vertical' });
    await flush();
    expect(separator.getAttribute('aria-orientation')).toBe('horizontal');
    expect(latest(separator).style.tokens).toContain('h-px');
    setElementProps(root, {});
    await flush();
    expect(separator.getAttribute('aria-orientation')).toBe('vertical');
    expect(latest(separator).style.tokens).not.toContain('h-px');
    expectNeutral(button, separator);
    expect(latest(root).material.candidates).toEqual([{ intent: 'liquid-glass' }]);
  });

  it('keeps ToggleGroup controlled selection and axis withdrawal on the original owner', async () => {
    const root = make(toggleGroup.toggleGroupRoot, { value: ['a'], orientation: 'vertical' });
    const a = make(toggleGroup.toggleGroupItem, { value: 'a' });
    const b = make(toggleGroup.toggleGroupItem, { value: 'b' });
    a.textContent = 'First';
    b.textContent = 'Second';
    root.append(a, b);
    document.body.append(root);
    await flush();
    const requests: unknown[] = [];
    root.addEventListener('valueChange', (event) => requests.push((event as CustomEvent).detail));
    click(b);
    await flush();
    expect(requests).toHaveLength(1);
    expect(b.getExposes().active.get()).toBe(false);
    expect(latest(root).style.tokens).toContain('flex-col');
    setElementProps(root, { value: ['b'] });
    await flush();
    expect(b.getExposes().active.get()).toBe(true);
    expect(latest(root).style.tokens).not.toContain('flex-col');
    expectNeutral(a, b);
  });

  it('preserves passive Text slot identity and restores all finite presentation defaults on removal', async () => {
    const root = make(textRoot, {
      size: 'xl',
      tone: 'muted',
      weight: 'bold',
      font: 'mono',
      leading: 'tight',
      tracking: 'tight',
      emphasis: 'italic',
      decoration: 'underline',
    });
    const authored = document.createElement('span');
    authored.textContent = 'Ordinary selectable content';
    root.append(authored);
    document.body.append(root);
    await flush();
    expect(root.querySelector('span')).toBe(authored);
    expect(latest(root).style.tokens).toEqual(
      expect.arrayContaining(['text-xl', 'font-bold', 'font-mono', 'italic', 'underline'])
    );
    setElementProps(root, {});
    await flush();
    expect(root.querySelector('span')).toBe(authored);
    expect(latest(root).style.tokens).not.toContain('text-xl');
    expect(latest(root).style.tokens).not.toContain('font-bold');
    expect(latest(root).style.tokens.some((token) => token.startsWith('select-'))).toBe(false);
    expectNeutral(root);
  });
});

describe('Liquid scalar Slider: transient material never owns value or capture', () => {
  for (const fieldBound of [false, true]) {
    it(`withdraws on opt-out, cancellation and retirement, fieldBound=${fieldBound}`, async () => {
      const root = make(slider.sliderRoot, { value: 25 });
      const track = make(slider.sliderTrack);
      const thumb = make(fieldBound ? slider.sliderFieldThumb : slider.sliderThumb);
      track.append(thumb);
      root.append(track);
      const owner = fieldBound ? make(field.fieldRoot) : null;
      if (owner) {
        owner.append(root);
        document.body.append(owner);
      } else document.body.append(root);
      await flush();
      track.getBoundingClientRect = () => new DOMRect(10, 0, 200, 12);
      thumb.getBoundingClientRect = () => new DOMRect(46, -8, 28, 28);
      const candidate = [
        {
          intent: 'liquid-glass',
          variant: 'regular',
          deformation: { kind: 'press', phase: 'pressed', contact: 'pointer' },
        },
      ];
      expectNeutral(root, track);
      expect(latest(thumb).material.candidates).toEqual([]);
      expect(latest(thumb).style.tokens).toEqual(
        expect.arrayContaining(['bg-background', 'text-foreground'])
      );
      thumb.dispatchEvent(pointer('pointerdown'));
      await flush();
      expect(thumb.getExposes().pressed.get()).toBe(true);
      expect(root.getExposes().value.get()).toBe(25);
      expect(latest(thumb).material.candidates).toEqual(candidate);
      setElementProps(thumb, { material: 'opaque' });
      await flush();
      expect(thumb.getExposes().pressed.get()).toBe(true);
      expect(latest(thumb).material.candidates).toEqual([]);
      setElementProps(thumb, {});
      await flush();
      expect(latest(thumb).material.candidates).toEqual(candidate);
      thumb.dispatchEvent(pointer('pointerleave'));
      await flush();
      expect(thumb.getExposes().pressed.get()).toBe(true);
      expect(latest(thumb).material.candidates).toEqual(candidate);
      setElementProps(root, { value: 25, readOnly: true });
      await flush();
      expect(thumb.getExposes().pressed.get()).toBe(false);
      expect(latest(thumb).material.candidates).toEqual([]);
      setElementProps(root, { value: 25 });
      await flush();
      thumb.dispatchEvent(pointer('pointerdown', { pointerId: 8 }));
      await flush();
      expect(latest(thumb).material.candidates).toEqual(candidate);
      thumb.remove();
      await flush();
      expect(root.getExposes().dragging.get()).toBe(false);
      expect(releases.get(thumb)).toBeGreaterThan(0);
      track.dispatchEvent(pointer('pointerup', { pointerId: 8, clientX: 180 }));
      expect(root.getExposes().value.get()).toBe(25);
      track.append(thumb);
      await flush();
      expect(thumb.getExposes().pressed.get()).toBe(false);
      expect(latest(thumb).material.candidates).toEqual([]);
      expect(frames.get(thumb)!.every((frame) => frame.material.candidates.length <= 1)).toBe(true);
    });
  }
});
