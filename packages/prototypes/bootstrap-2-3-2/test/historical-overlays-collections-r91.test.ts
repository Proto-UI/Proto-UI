import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { styleContains } from '../../test-utils/style';
import * as alert from '../src/alert-dialog';
import * as popover from '../src/popover';
import * as carousel from '../src/carousel';
import * as calendar from '../src/calendar';
import * as picker from '../src/date-picker';
import * as table from '../src/data-table';
import * as progress from '../src/progress';
import * as meter from '../src/meter';
import * as tree from '../src/tree';
import * as toast from '../src/toast';

type Host = HTMLElement & { getExposes(): Record<string, unknown> };

const prototypes = [
  alert.alertDialogRoot,
  alert.alertDialogTrigger,
  alert.alertDialogMask,
  alert.alertDialogContent,
  alert.alertDialogTitle,
  alert.alertDialogDescription,
  alert.alertDialogCancel,
  alert.alertDialogAction,
  popover.popoverRoot,
  popover.popoverTrigger,
  popover.popoverContent,
  popover.popoverTitle,
  popover.popoverDescription,
  popover.popoverClose,
  carousel.carouselRoot,
  carousel.carouselViewport,
  carousel.carouselSlide,
  carousel.carouselPrevious,
  carousel.carouselNext,
  calendar.calendarRoot,
  calendar.calendarCaption,
  calendar.calendarGrid,
  calendar.calendarWeekdays,
  calendar.calendarWeekday,
  calendar.calendarRow,
  calendar.calendarDay,
  calendar.calendarHeading,
  calendar.calendarPrevious,
  calendar.calendarNext,
  picker.datePickerRoot,
  picker.datePickerTrigger,
  picker.datePickerContent,
  picker.datePickerDay,
  picker.datePickerValue,
  table.dataTableRoot,
  table.dataTableRow,
  table.dataTableHeaderRow,
  table.dataTableCell,
  table.dataTableHeader,
  table.dataTableCaption,
  table.dataTablePrevious,
  table.dataTableNext,
  progress.progressRoot,
  progress.progressLabel,
  progress.progressTrack,
  progress.progressIndicator,
  progress.progressValue,
  meter.meterRoot,
  meter.meterLabel,
  meter.meterTrack,
  meter.meterIndicator,
  meter.meterValue,
  tree.treeRoot,
  tree.treeItem,
  tree.treeGroup,
  tree.treeToggle,
  toast.toastRoot,
  toast.toastViewport,
  toast.toastTitle,
  toast.toastDescription,
  toast.toastAction,
  toast.toastClose,
] as const;
for (const proto of prototypes)
  AdaptToWebComponent(proto, { registerAs: `historical-r91-${proto.name}` });

function node(proto: { name: string }, props: Record<string, unknown> = {}, text?: string) {
  const element = document.createElement(`historical-r91-${proto.name}`) as Host;
  setElementProps(element, props);
  if (text !== undefined) element.textContent = text;
  return element;
}
function stateValue<T>(element: Host, key: string): T {
  const state = element.getExposes()[key];
  if (!state || typeof state !== 'object' || !('get' in state) || typeof state.get !== 'function')
    throw new Error(`[historical-r91] Missing readable state ${key}`);
  return state.get() as T;
}
function invoke<T>(element: Host, key: string, ...args: unknown[]): T {
  const method = element.getExposes()[key];
  if (typeof method !== 'function') throw new Error(`[historical-r91] Missing method ${key}`);
  return method(...args) as T;
}
function details(element: HTMLElement, type: string) {
  const values: unknown[] = [];
  element.addEventListener(type, (event) => {
    if (!(event instanceof CustomEvent)) throw new Error(`[historical-r91] Non-custom ${type}`);
    values.push(event.detail);
  });
  return values;
}
async function flush() {
  for (let i = 0; i < 24; i++) await Promise.resolve();
}
async function click(element: HTMLElement) {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await flush();
}
async function completeTransitions(...elements: Host[]) {
  for (const element of elements) {
    const phase = stateValue<string>(element, 'transitionState');
    if (phase !== 'entering' && phase !== 'leaving') continue;
    const controls = element.getExposes()['controls'];
    if (
      !controls ||
      typeof controls !== 'object' ||
      !('complete' in controls) ||
      typeof controls.complete !== 'function'
    )
      throw new Error('[historical-r91] Missing transition completion control');
    controls.complete();
  }
  await flush();
}

afterEach(async () => {
  document.body.replaceChildren();
  await flush();
  vi.useRealTimers();
});

function alertFixture(props: Record<string, unknown> = {}) {
  const root = node(alert.alertDialogRoot, { a11yLabel: 'Delete record', ...props });
  const trigger = node(alert.alertDialogTrigger, {}, 'Delete');
  const mask = node(alert.alertDialogMask);
  const content = node(alert.alertDialogContent);
  const title = node(alert.alertDialogTitle, {}, 'Delete record?');
  const description = node(alert.alertDialogDescription, {}, 'This action cannot be undone.');
  const cancel = node(alert.alertDialogCancel, {}, 'Cancel');
  const action = node(alert.alertDialogAction, {}, 'Confirm deletion');
  content.append(title, description, cancel, action);
  root.append(trigger, mask, content);
  document.body.append(root);
  return { root, trigger, mask, content, title, description, cancel, action };
}

describe('Bootstrap historical modal and popup consumers', () => {
  it('keeps disabled AlertDialog commands, cancel entry, relations and leaving retention', async () => {
    const f = alertFixture({ disabled: true });
    const requests = details(f.root, 'openChange');
    await flush();
    await click(f.trigger);
    expect(requests).toEqual([]);
    expect(stateValue(f.root, 'open')).toBe(false);
    expect(stateValue(f.trigger, 'disabled')).toBe(true);

    setElementProps(f.root, { disabled: false });
    await flush();
    f.trigger.focus();
    await click(f.trigger);
    expect(stateValue(f.root, 'open')).toBe(true);
    expect(f.content.getAttribute('role')).toBe('alertdialog');
    expect(f.content.getAttribute('aria-modal')).toBe('true');
    expect(f.content.getAttribute('aria-labelledby')).toBe(f.title.id);
    expect(f.content.getAttribute('aria-describedby')).toBe(f.description.id);
    expect(stateValue(f.content, 'transitionState')).toBe('entering');
    expect(styleContains(f.content, 'w-[560px]')).toBe(true);
    expect(styleContains(f.content, 'top-[10%]')).toBe(true);
    expect(styleContains(f.title, 'text-[24.5px]')).toBe(true);
    expect(styleContains(f.description, 'p-[15px]')).toBe(true);
    expect(styleContains(f.trigger, 'px-[12px]')).toBe(true);
    expect(f.title.textContent).toBe('Delete record?');
    await completeTransitions(f.mask, f.content);
    expect(document.activeElement).toBe(f.cancel);

    f.title.remove();
    await flush();
    expect(f.content.hasAttribute('aria-labelledby')).toBe(false);
    expect(f.content.getAttribute('aria-label')).toBe('Delete record');
    await click(f.cancel);
    expect(stateValue(f.root, 'open')).toBe(false);
    expect(stateValue(f.content, 'transitionState')).toBe('leaving');
    expect(f.content.hasAttribute('data-pui-view-detached')).toBe(false);
    await completeTransitions(f.mask, f.content);
    expect(f.content.hasAttribute('data-pui-view-detached')).toBe(true);
    expect(f.mask.hasAttribute('data-pui-view-detached')).toBe(true);
    expect(document.activeElement).toBe(f.trigger);
  });

  it('preserves AlertDialog action-before-close and controlled refusal without outside dismissal', async () => {
    const f = alertFixture({ open: true });
    const requests = details(f.root, 'openChange');
    const order: string[] = [];
    f.action.addEventListener('action', () => order.push('action'));
    f.root.addEventListener('openChange', () => order.push('request'));
    await flush();
    await completeTransitions(f.mask, f.content);
    await click(f.action);
    expect(order).toEqual(['action', 'request']);
    expect(requests).toEqual([expect.objectContaining({ open: false, reason: 'action.press' })]);
    expect(stateValue(f.root, 'open')).toBe(true);
    expect(stateValue(f.content, 'transitionState')).toBe('entered');
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await flush();
    expect(requests).toHaveLength(1);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flush();
    expect(requests.at(-1)).toEqual(expect.objectContaining({ open: false, reason: 'escape' }));
    expect(stateValue(f.root, 'open')).toBe(true);
    setElementProps(f.root, { open: false });
    await flush();
    await completeTransitions(f.mask, f.content);
    expect(f.content.hasAttribute('data-pui-view-detached')).toBe(true);
  });

  it('keeps Popover title/body paint separate, preserves slots and restores trigger focus', async () => {
    const root = node(popover.popoverRoot, { a11yLabel: 'Details' });
    const trigger = node(popover.popoverTrigger, {}, 'Details');
    const content = node(popover.popoverContent);
    const title = node(popover.popoverTitle, {}, 'Account');
    const description = node(popover.popoverDescription, {}, 'Saved ');
    const emphasis = document.createElement('em');
    emphasis.textContent = 'locally';
    description.append(emphasis);
    const close = node(popover.popoverClose, {}, 'Close');
    content.append(title, description, close);
    root.append(trigger, content);
    document.body.append(root);
    await flush();
    trigger.focus();
    await click(trigger);
    expect(stateValue(root, 'open')).toBe(true);
    expect(stateValue(content, 'transitionState')).toBe('entering');
    expect(content.getAttribute('aria-labelledby')).toBe(title.id);
    expect(content.getAttribute('aria-describedby')).toBe(description.id);
    expect(styleContains(content, 'p-[1px]')).toBe(true);
    expect(styleContains(content, 'max-w-[min(276px,var(--proto-ui-available-width))]')).toBe(true);
    expect(styleContains(title, 'py-[8px]')).toBe(true);
    expect(styleContains(title, 'font-normal')).toBe(true);
    expect(styleContains(description, 'py-[9px]')).toBe(true);
    expect(content.querySelectorAll('em')).toHaveLength(1);
    expect(content.textContent).toBe('AccountSaved locallyClose');
    await completeTransitions(content);
    description.remove();
    await flush();
    expect(content.hasAttribute('aria-describedby')).toBe(false);
    await click(close);
    expect(stateValue(content, 'transitionState')).toBe('leaving');
    await completeTransitions(content);
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps controlled Popover requests and local disabled Close independent', async () => {
    const root = node(popover.popoverRoot, { open: false, a11yLabel: 'Details' });
    const trigger = node(popover.popoverTrigger, {}, 'Details');
    const content = node(popover.popoverContent);
    const close = node(popover.popoverClose, { disabled: true }, 'Close');
    content.append(close);
    root.append(trigger, content);
    document.body.append(root);
    const requests = details(root, 'openChange');
    await flush();
    await click(trigger);
    expect(requests).toEqual([expect.objectContaining({ open: true, reason: 'trigger.press' })]);
    expect(stateValue(root, 'open')).toBe(false);
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);
    setElementProps(root, { open: true });
    await flush();
    await completeTransitions(content);
    await click(close);
    expect(requests).toHaveLength(1);
    setElementProps(close, { disabled: false });
    await flush();
    await click(close);
    expect(requests.at(-1)).toEqual(
      expect.objectContaining({ open: false, reason: 'close.press' })
    );
    expect(stateValue(root, 'open')).toBe(true);
    setElementProps(root, { open: false });
    await flush();
    await completeTransitions(content);
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);
    setElementProps(root, { disabled: true });
    await flush();
    const count = requests.length;
    await click(trigger);
    expect(requests).toHaveLength(count);
    expect(stateValue(trigger, 'disabled')).toBe(true);
    setElementProps(root, { disabled: false });
    await flush();
    await click(trigger);
    expect(requests).toHaveLength(count + 1);
    expect(stateValue(root, 'open')).toBe(false);
  });
});

function carouselFixture(props: Record<string, unknown> = {}) {
  const root = node(carousel.carouselRoot, props);
  const viewport = node(carousel.carouselViewport);
  const slides = [0, 1, 2].map((index) =>
    node(carousel.carouselSlide, { index }, `Slide ${index + 1}`)
  );
  const previous = node(carousel.carouselPrevious, {}, '‹');
  const next = node(carousel.carouselNext, {}, '›');
  viewport.append(...slides);
  root.append(viewport, previous, next);
  document.body.append(root);
  return { root, viewport, slides, previous, next };
}

describe('Bootstrap historical collection consumers', () => {
  it('keeps Carousel index ownership, real slide slots and boundary reconciliation', async () => {
    const f = carouselFixture();
    await flush();
    expect(stateValue(f.root, 'slideCount')).toBe(3);
    expect(stateValue(f.slides[0]!, 'current')).toBe(true);
    expect(stateValue(f.previous, 'disabled')).toBe(true);
    expect(styleContains(f.previous, 'w-[40px]')).toBe(true);
    expect(styleContains(f.next, 'text-[60px]')).toBe(true);
    await click(f.next);
    await click(f.next);
    expect(stateValue(f.root, 'index')).toBe(2);
    expect(stateValue(f.slides[0]!, 'hidden')).toBe(true);
    expect(stateValue(f.slides[2]!, 'current')).toBe(true);
    expect(stateValue(f.next, 'disabled')).toBe(true);
    expect(f.slides[2]!.textContent).toBe('Slide 3');
    f.slides[2]!.remove();
    await flush();
    expect(stateValue(f.root, 'slideCount')).toBe(2);
    expect(stateValue(f.root, 'index')).toBe(1);
    expect(stateValue(f.slides[1]!, 'current')).toBe(true);
    setElementProps(f.root, { loop: true });
    await flush();
    await click(f.next);
    expect(stateValue(f.root, 'index')).toBe(0);
    expect(stateValue(f.previous, 'disabled')).toBe(false);
  });

  it('retains controlled Carousel refusal and vertical keyboard navigation requests', async () => {
    const f = carouselFixture({ index: 0, orientation: 'vertical', direction: 'rtl' });
    const requests = details(f.root, 'indexChange');
    await flush();
    await click(f.next);
    expect(requests).toEqual([{ index: 1 }]);
    expect(stateValue(f.root, 'index')).toBe(0);
    expect(stateValue(f.slides[0]!, 'current')).toBe(true);
    setElementProps(f.root, { index: 1 });
    await flush();
    f.viewport.focus();
    f.viewport.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
    );
    await flush();
    expect(requests.at(-1)).toEqual({ index: 2 });
    expect(stateValue(f.root, 'index')).toBe(1);
    setElementProps(f.root, { disabled: true });
    await flush();
    await click(f.next);
    expect(requests).toHaveLength(2);
    expect(stateValue(f.next, 'disabled')).toBe(true);
  });

  it('preserves all Calendar renderers, controlled date/month acceptance and row withdrawal', async () => {
    const root = node(calendar.calendarRoot, {
      month: '2026-02',
      value: '2026-02-10',
      locale: 'fr-FR',
      weekStartsOn: 0,
    });
    const caption = node(calendar.calendarCaption);
    const previous = node(calendar.calendarPrevious, {}, '‹');
    const heading = node(calendar.calendarHeading);
    const next = node(calendar.calendarNext, {}, '›');
    caption.append(previous, heading, next);
    const grid = node(calendar.calendarGrid);
    const weekdays = node(calendar.calendarWeekdays);
    const weekday = node(calendar.calendarWeekday, { offset: 0 });
    weekdays.append(weekday);
    const days: Host[] = [];
    const rows = Array.from({ length: 6 }, (_, index) => {
      const row = node(calendar.calendarRow, { index });
      for (let i = 0; i < 7; i++) {
        const day = node(calendar.calendarDay, { offset: index * 7 + i });
        days.push(day);
        row.append(day);
      }
      return row;
    });
    grid.append(weekdays, ...rows);
    root.append(caption, grid);
    document.body.append(root);
    const valueRequests = details(root, 'valueChange');
    const monthRequests = details(root, 'monthChange');
    await flush();
    const byDate = (date: string) => {
      const day = days.find((element) => stateValue(element, 'date') === date);
      if (!day) throw new Error(`[historical-r91] Date not realized: ${date}`);
      return day;
    };
    expect(heading.textContent).toBe('février 2026');
    expect(weekday.textContent).toBe('dim.');
    expect(stateValue(root, 'weekCount')).toBe(4);
    expect(stateValue(rows[4]!, 'hidden')).toBe(true);
    expect(byDate('2026-02-10').textContent).toBe('10');
    await click(byDate('2026-02-12'));
    expect(valueRequests).toEqual([{ value: '2026-02-12' }]);
    expect(stateValue(root, 'value')).toBe('2026-02-10');
    expect(stateValue(byDate('2026-02-10'), 'selected')).toBe(true);
    expect(stateValue(byDate('2026-02-12'), 'selected')).toBe(false);
    setElementProps(root, { value: '2026-02-12', fixedWeeks: true, direction: 'rtl' });
    await flush();
    expect(stateValue(byDate('2026-02-10'), 'selected')).toBe(false);
    expect(stateValue(byDate('2026-02-12'), 'selected')).toBe(true);
    expect(stateValue(rows[5]!, 'hidden')).toBe(false);
    expect(stateValue(root, 'direction')).toBe('rtl');
    setElementProps(root, { disabled: true });
    await flush();
    await click(byDate('2026-02-13'));
    await click(next);
    expect(valueRequests).toHaveLength(1);
    expect(monthRequests).toEqual([]);
    expect(stateValue(previous, 'disabled')).toBe(true);
    setElementProps(root, {
      disabled: false,
      readOnly: true,
      min: '2026-02-10',
      max: '2026-02-20',
      unavailable: ['2026-02-14'],
    });
    await flush();
    expect(stateValue(byDate('2026-02-09'), 'disabled')).toBe(true);
    expect(stateValue(byDate('2026-02-14'), 'disabled')).toBe(true);
    expect(stateValue(byDate('2026-02-21'), 'disabled')).toBe(true);
    await click(byDate('2026-02-13'));
    expect(valueRequests).toHaveLength(1);
    setElementProps(root, { readOnly: false, min: '', max: '', unavailable: [] });
    await flush();
    await click(next);
    expect(monthRequests).toEqual([{ month: '2026-03' }]);
    expect(heading.textContent).toBe('février 2026');
    setElementProps(root, { month: '2026-03', direction: 'ltr' });
    await flush();
    expect(heading.textContent).toBe('mars 2026');
    expect(previous.textContent).toBe('‹');
    expect(next.getAttribute('aria-label')).toBe('Next month');
  });

  it('retains DatePicker Calendar/Popover composition through controlled refusal and acceptance', async () => {
    const root = node(picker.datePickerRoot, {
      open: false,
      value: '2026-10-01',
      month: '2026-10',
    });
    const trigger = node(picker.datePickerTrigger);
    const value = node(picker.datePickerValue);
    trigger.append(value);
    const content = node(picker.datePickerContent);
    const grid = node(calendar.calendarGrid);
    const row = node(calendar.calendarRow);
    const day = node(picker.datePickerDay, { date: '2026-10-12' });
    row.append(day);
    grid.append(row);
    content.append(grid);
    root.append(trigger, content);
    document.body.append(root);
    const openRequests = details(root, 'openChange');
    const valueRequests = details(root, 'valueChange');
    await flush();
    expect(value.textContent).toBe('2026-10-01');
    await click(trigger);
    expect(openRequests.at(-1)).toEqual(expect.objectContaining({ open: true }));
    expect(stateValue(root, 'open')).toBe(false);
    setElementProps(root, { open: true });
    await flush();
    await completeTransitions(content);
    expect(content.contains(grid)).toBe(true);
    expect(day.textContent).toBe('12');
    expect(content.querySelectorAll(`historical-r91-${calendar.calendarGrid.name}`)).toHaveLength(
      1
    );
    await click(day);
    expect(valueRequests).toEqual([{ value: '2026-10-12' }]);
    expect(openRequests.at(-1)).toEqual(
      expect.objectContaining({ open: false, reason: 'date-selection' })
    );
    expect(stateValue(root, 'value')).toBe('2026-10-01');
    expect(stateValue(root, 'open')).toBe(true);
    expect(value.textContent).toBe('2026-10-01');
    setElementProps(root, { value: '2026-10-12', open: false });
    await flush();
    await completeTransitions(content);
    expect(value.textContent).toBe('2026-10-12');
    expect(content.hasAttribute('data-pui-view-detached')).toBe(true);
    setElementProps(root, { disabled: true });
    await flush();
    const count = openRequests.length;
    await click(trigger);
    expect(openRequests).toHaveLength(count);
    expect(stateValue(trigger, 'disabled')).toBe(true);
  });
});

const dataRows = [
  { id: 'a', name: 'Zeta', score: 3 },
  { id: 'b', name: 'Alpha', score: 1 },
  { id: 'c', name: 'Beta', score: 2 },
];
function tableFixture(props: Record<string, unknown> = {}) {
  const root = node(table.dataTableRoot, { rows: dataRows, pageSize: 2, ...props });
  const caption = node(table.dataTableCaption, {}, 'Transfer records');
  const head = node(table.dataTableHeaderRow);
  const headers = ['name', 'score'].map((headerKey) =>
    node(table.dataTableHeader, { headerKey, headerKind: 'column' }, headerKey)
  );
  head.append(...headers);
  const cells: Host[] = [];
  const rows = [0, 1].map((index) => {
    const row = node(table.dataTableRow, { index });
    const cell = node(table.dataTableCell, { columnKey: 'name', headers: ['name'] });
    cells.push(cell);
    row.append(cell, node(table.dataTableCell, { columnKey: 'score', headers: ['score'] }));
    return row;
  });
  const previous = node(table.dataTablePrevious, {}, 'Previous');
  const next = node(table.dataTableNext, {}, 'Next');
  root.append(caption, head, ...rows, previous, next);
  document.body.append(root);
  return { root, caption, head, headers, rows, cells, previous, next };
}

describe('Bootstrap Table-derived DataTable consumers', () => {
  it('keeps passive HeaderRow, independent sorting, table relations and actual cell text', async () => {
    const f = tableFixture();
    const sorts = details(f.root, 'sortChange');
    const selections = details(f.root, 'selectionChange');
    await flush();
    expect(invoke(f.root, 'getStructure')).toMatchObject({
      valid: true,
      rowCount: 3,
      columnCount: 2,
    });
    expect(stateValue(f.root, 'count')).toBe(2);
    expect(f.head.getAttribute('role')).toBe('row');
    expect(f.head.tabIndex).toBe(-1);
    expect(f.head.hasAttribute('aria-selected')).toBe(false);
    expect(f.caption.textContent).toBe('Transfer records');
    expect(f.cells.map((cell) => cell.textContent)).toEqual(['Zeta', 'Alpha']);
    expect(styleContains(f.root, 'border-collapse')).toBe(true);
    expect(styleContains(f.cells[0]!, 'p-[8px]')).toBe(true);
    await click(f.head);
    expect(sorts).toEqual([]);
    expect(selections).toEqual([]);
    await click(f.headers[0]!);
    expect(sorts).toEqual([{ sortKey: 'name', sortDirection: 'ascending' }]);
    expect(f.cells.map((cell) => cell.textContent)).toEqual(['Alpha', 'Beta']);
    expect(f.headers[0]!.getAttribute('aria-sort')).toBe('ascending');
    await click(f.headers[1]!);
    expect(sorts.at(-1)).toEqual({ sortKey: 'score', sortDirection: 'ascending' });
    expect(f.headers[0]!.getAttribute('aria-sort')).toBe('none');
    expect(f.headers[1]!.getAttribute('aria-sort')).toBe('ascending');
    await click(f.rows[0]!);
    expect(stateValue(f.rows[0]!, 'selected')).toBe(true);
    expect(selections).toEqual([{ selectedKeys: ['b'] }]);
    await click(f.next);
    expect(f.cells[0]!.textContent).toBe('Zeta');
    expect(stateValue(f.rows[1]!, 'hidden')).toBe(true);
    await click(f.previous);
    expect(f.cells[0]!.textContent).toBe('Alpha');
    setElementProps(f.root, { readOnly: true });
    await flush();
    await click(f.rows[0]!);
    expect(selections).toHaveLength(1);
  });

  it('keeps controlled sort/page/selection requests canonical and disabled requests suppressed', async () => {
    const f = tableFixture({ sortKey: '', sortDirection: 'none', page: 0, selectedKeys: [] });
    const sorts = details(f.root, 'sortChange');
    const pages = details(f.root, 'pageChange');
    const selections = details(f.root, 'selectionChange');
    await flush();
    await click(f.headers[0]!);
    await click(f.rows[0]!);
    await click(f.next);
    expect(sorts).toEqual([{ sortKey: 'name', sortDirection: 'ascending' }]);
    expect(pages).toEqual([{ page: 1 }]);
    expect(selections).toEqual([{ selectedKeys: ['a'] }]);
    expect(f.cells[0]!.textContent).toBe('Zeta');
    expect(f.headers[0]!.getAttribute('aria-sort')).toBe('none');
    expect(stateValue(f.rows[0]!, 'selected')).toBe(false);
    setElementProps(f.root, {
      sortKey: 'name',
      sortDirection: 'ascending',
      page: 1,
      selectedKeys: ['a'],
    });
    await flush();
    expect(f.cells[0]!.textContent).toBe('Zeta');
    expect(stateValue(f.rows[0]!, 'selected')).toBe(true);
    expect(f.headers[0]!.getAttribute('aria-sort')).toBe('ascending');
    setElementProps(f.root, { disabled: true });
    await flush();
    await click(f.headers[1]!);
    await click(f.previous);
    await click(f.rows[0]!);
    expect(sorts).toHaveLength(1);
    expect(pages).toHaveLength(1);
    expect(selections).toHaveLength(1);
  });
});

function progressFixture(props: Record<string, unknown>) {
  const root = node(progress.progressRoot, props);
  const label = node(progress.progressLabel, {}, 'Upload');
  const track = node(progress.progressTrack);
  const indicator = node(progress.progressIndicator);
  const value = node(progress.progressValue);
  track.append(indicator);
  root.append(label, track, value);
  document.body.append(root);
  return { root, label, track, indicator, value };
}

describe('Bootstrap numerical and hierarchical consumers', () => {
  it('preserves Progress clamping, live percentage transport and indeterminate withdrawal', async () => {
    const f = progressFixture({ value: 25, min: 0, max: 50, ariaLabel: 'Upload status' });
    await flush();
    expect(f.root.getAttribute('role')).toBe('progressbar');
    expect(f.root.getAttribute('aria-labelledby')).toBe(f.label.id);
    expect(f.root.getAttribute('aria-valuenow')).toBe('25');
    expect(stateValue(f.indicator, 'percentage')).toBe(50);
    expect(f.indicator.style.getPropertyValue('--pui-percentage')).toBe('50');
    expect(f.value.textContent).toBe('25');
    expect(styleContains(f.track, 'h-[20px]')).toBe(true);
    setElementProps(f.root, { value: 70 });
    await flush();
    expect(stateValue(f.root, 'value')).toBe(50);
    expect(stateValue(f.root, 'status')).toBe('complete');
    expect(f.indicator.style.getPropertyValue('--pui-percentage')).toBe('100');
    setElementProps(f.root, { indeterminate: true });
    await flush();
    expect(stateValue(f.indicator, 'indeterminate')).toBe(true);
    expect(f.root.hasAttribute('aria-valuenow')).toBe(false);
    expect(f.value.textContent).toBe('');
    setElementProps(f.root, { indeterminate: false, value: 10 });
    await flush();
    expect(stateValue(f.indicator, 'indeterminate')).toBe(false);
    expect(f.root.getAttribute('aria-valuenow')).toBe('10');
    expect(f.indicator.style.getPropertyValue('--pui-percentage')).toBe('20');
    expect(f.value.textContent).toBe('10');
  });

  it('keeps Meter optimal/suboptimal/critical facts separate from percentage and readout', async () => {
    const root = node(meter.meterRoot, { value: 90, low: 20, high: 70, optimum: 10 });
    const label = node(meter.meterLabel, {}, 'Pressure');
    const track = node(meter.meterTrack);
    const indicator = node(meter.meterIndicator);
    const value = node(meter.meterValue);
    track.append(indicator);
    root.append(label, track, value);
    document.body.append(root);
    await flush();
    expect(root.getAttribute('role')).toBe('meter');
    expect(root.getAttribute('aria-labelledby')).toBe(label.id);
    expect(stateValue(indicator, 'status')).toBe('critical');
    expect(indicator.style.getPropertyValue('--pui-percentage')).toBe('90');
    setElementProps(root, { value: 50 });
    await flush();
    expect(stateValue(indicator, 'status')).toBe('suboptimal');
    expect(indicator.style.getPropertyValue('--pui-percentage')).toBe('50');
    setElementProps(root, { value: 10, valueText: 'Low pressure' });
    await flush();
    expect(stateValue(indicator, 'status')).toBe('optimal');
    expect(root.getAttribute('aria-valuenow')).toBe('10');
    expect(indicator.style.getPropertyValue('--pui-percentage')).toBe('10');
    expect(value.textContent).toBe('Low pressure');
  });

  it('preserves Tree controlled expansion/selection, slots, disabled policy and focus independence', async () => {
    const root = node(tree.treeRoot, { value: 'parent', expandedKeys: [] });
    const parent = node(tree.treeItem, { nodeKey: 'parent', textValue: 'Parent' }, 'Parent');
    const toggle = node(tree.treeToggle, { nodeKey: 'parent' }, 'Expand');
    const group = node(tree.treeGroup, { nodeKey: 'parent' });
    const child = node(
      tree.treeItem,
      { nodeKey: 'child', parentKey: 'parent', textValue: 'Child' },
      'Child'
    );
    const last = node(tree.treeItem, { nodeKey: 'last', textValue: 'Last' }, 'Last');
    group.append(child);
    root.append(parent, toggle, group, last);
    document.body.append(root);
    const expansions = details(root, 'expandedChange');
    const values = details(root, 'valueChange');
    await flush();
    expect(stateValue(root, 'invalid')).toBe(false);
    expect(stateValue(child, 'hidden')).toBe(true);
    await click(toggle);
    expect(expansions).toEqual([{ expandedKeys: ['parent'] }]);
    expect(stateValue(child, 'hidden')).toBe(true);
    setElementProps(root, { expandedKeys: ['parent'] });
    await flush();
    expect(stateValue(child, 'hidden')).toBe(false);
    expect(child.getAttribute('aria-level')).toBe('2');
    expect(group.getAttribute('role')).toBe('group');
    expect(group.textContent).toBe('Child');
    await click(child);
    expect(values).toEqual([{ value: 'child' }]);
    expect(stateValue(root, 'value')).toBe('parent');
    setElementProps(root, { value: 'child' });
    await flush();
    expect(stateValue(parent, 'selected')).toBe(false);
    expect(stateValue(child, 'selected')).toBe(true);
    invoke(child, 'focusSelf', { reason: 'keyboard' });
    await flush();
    child.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true })
    );
    await flush();
    expect(document.activeElement).toBe(parent);
    expect(stateValue(root, 'value')).toBe('child');
    setElementProps(root, { disabled: true });
    await flush();
    await click(last);
    await click(toggle);
    expect(values).toHaveLength(1);
    expect(expansions).toHaveLength(1);
    expect(stateValue(toggle, 'disabled')).toBe(true);
  });
});

function toastFixture(props: Record<string, unknown> = {}) {
  const viewport = node(toast.toastViewport);
  const root = node(toast.toastRoot, { duration: 0, ...props });
  const close = node(toast.toastClose, {}, '×');
  const title = node(toast.toastTitle, {}, 'Saved');
  const description = node(toast.toastDescription, {}, 'Your settings were saved.');
  const action = node(toast.toastAction, {}, 'Undo');
  root.append(close, title, description, action);
  viewport.append(root);
  document.body.append(viewport);
  return { viewport, root, close, title, description, action };
}

describe('Bootstrap alert-derived Toast consumers', () => {
  it('keeps the Base remaining-time pause/resume policy instead of replacing it with paint timers', async () => {
    vi.useFakeTimers();
    const f = toastFixture({ duration: 100 });
    const requests = details(f.root, 'openChange');
    await flush();
    expect(f.root.getAttribute('role')).toBe('status');
    expect(f.root.getAttribute('aria-labelledby')).toBe(f.title.id);
    expect(f.root.getAttribute('aria-describedby')).toBe(f.description.id);
    expect(styleContains(f.root, 'pr-[35px]')).toBe(true);
    expect(styleContains(f.title, 'text-[17.5px]')).toBe(true);
    await vi.advanceTimersByTimeAsync(40);
    invoke(f.root, 'pause');
    await flush();
    expect(stateValue(f.root, 'paused')).toBe(true);
    await vi.advanceTimersByTimeAsync(150);
    expect(stateValue(f.root, 'open')).toBe(true);
    invoke(f.root, 'resume');
    await flush();
    await vi.advanceTimersByTimeAsync(59);
    expect(stateValue(f.root, 'open')).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    await flush();
    expect(stateValue(f.root, 'open')).toBe(false);
    expect(requests).toEqual([{ open: false, reason: 'timeout' }]);
  });

  it('keeps Toast action-before-dismiss, controlled refusal, live relations and local disabled commands', async () => {
    const f = toastFixture({ open: true });
    const requests = details(f.root, 'openChange');
    const order: string[] = [];
    f.action.addEventListener('action', () => order.push('action'));
    f.root.addEventListener('openChange', () => order.push('request'));
    await flush();
    setElementProps(f.action, { disabled: true });
    await flush();
    await click(f.action);
    expect(order).toEqual([]);
    setElementProps(f.action, { disabled: false });
    await flush();
    await click(f.action);
    expect(order).toEqual(['action', 'request']);
    expect(requests).toEqual([{ open: false, reason: 'action' }]);
    expect(stateValue(f.root, 'open')).toBe(true);
    f.title.remove();
    f.description.remove();
    await flush();
    expect(f.root.hasAttribute('aria-labelledby')).toBe(false);
    expect(f.root.hasAttribute('aria-describedby')).toBe(false);
    setElementProps(f.close, { disabled: true });
    await flush();
    await click(f.close);
    expect(requests).toHaveLength(1);
    setElementProps(f.close, { disabled: false });
    await flush();
    await click(f.close);
    expect(requests.at(-1)).toEqual({ open: false, reason: 'close' });
    expect(stateValue(f.root, 'open')).toBe(true);
    setElementProps(f.root, { open: false });
    await flush();
    await completeTransitions(f.root);
    expect(stateValue(f.root, 'open')).toBe(false);
    expect(f.root.hasAttribute('data-pui-view-detached')).toBe(true);
  });

  it('does not revive an Action dismissal continuation after its callback retires the command', async () => {
    const f = toastFixture();
    const requests = details(f.root, 'openChange');
    let actions = 0;
    f.action.addEventListener('action', () => {
      actions++;
      f.action.remove();
    });
    await flush();
    await click(f.action);
    expect(actions).toBe(1);
    expect(f.root.contains(f.action)).toBe(false);
    expect(requests).toEqual([]);
    expect(stateValue(f.root, 'open')).toBe(true);
  });
});
