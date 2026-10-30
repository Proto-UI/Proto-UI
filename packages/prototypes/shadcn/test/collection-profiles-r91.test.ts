import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  calendarRoot,
  calendarCaption,
  calendarGrid,
  calendarWeekdays,
  calendarWeekday,
  calendarRow,
  calendarDay,
  calendarHeading,
  calendarPrevious,
  calendarNext,
} from '../src/calendar';
import {
  datePickerRoot,
  datePickerTrigger,
  datePickerContent,
  datePickerDay,
  datePickerValue,
} from '../src/date-picker';
import {
  dataTableRoot,
  dataTableHeaderRow,
  dataTableHeader,
  dataTableRow,
  dataTableCell,
  dataTableCaption,
  dataTablePrevious,
  dataTableNext,
} from '../src/data-table';
import { treeRoot, treeItem, treeGroup, treeToggle } from '../src/tree';
import { toggleGroupRoot, toggleGroupItem } from '../src/toggle-group';
import { toolbarRoot, toolbarButton, toolbarSeparator } from '../src/toolbar';
import { styleScope } from '../src/style-scope';
import { styleContains } from '../../test-utils/style';

for (const proto of [
  calendarRoot,
  calendarCaption,
  calendarGrid,
  calendarWeekdays,
  calendarWeekday,
  calendarRow,
  calendarDay,
  calendarHeading,
  calendarPrevious,
  calendarNext,
  datePickerRoot,
  datePickerTrigger,
  datePickerContent,
  datePickerDay,
  datePickerValue,
  dataTableRoot,
  dataTableHeaderRow,
  dataTableHeader,
  dataTableRow,
  dataTableCell,
  dataTableCaption,
  dataTablePrevious,
  dataTableNext,
  treeRoot,
  treeItem,
  treeGroup,
  treeToggle,
  toggleGroupRoot,
  toggleGroupItem,
  toolbarRoot,
  toolbarButton,
  toolbarSeparator,
  styleScope,
])
  AdaptToWebComponent(proto, { registerAs: `collection-r91-${proto.name}` });

interface ValueState<T> {
  get(): T;
}
interface CalendarConsumer {
  value: ValueState<string>;
  month: ValueState<string>;
  direction: ValueState<'ltr' | 'rtl'>;
  requestValue(value: string): boolean;
}
interface DatePickerConsumer extends CalendarConsumer {
  open: ValueState<boolean>;
  close(reason?: string): void;
}
interface DayConsumer {
  selected: ValueState<boolean>;
  focusSelf(options?: { reason: 'keyboard' }): void;
}
interface TableConsumer {
  count: ValueState<number>;
  getRows(): Array<{ id: string }>;
  getStructure(): { valid: boolean; rowCount: number; columnCount: number };
}
interface TreeConsumer {
  value: ValueState<string>;
  getExpandedKeys(): string[];
  requestExpanded(key: string, open: boolean): boolean;
}
interface GroupConsumer {
  getValue(): string[];
  count: ValueState<number>;
}
interface ItemConsumer {
  active: ValueState<boolean>;
  disabled: ValueState<boolean>;
}
interface ToolbarConsumer {
  focusFirst(): void;
  disabled: ValueState<boolean>;
}
interface ToolbarButtonConsumer {
  disabled: ValueState<boolean>;
}

const element = <Exposes = Record<string, never>>(
  name: string,
  props: Record<string, unknown> = {}
) => {
  const node = document.createElement(`collection-r91-${name}`) as HTMLElement & {
    getExposes(): Exposes;
  };
  setElementProps(node, props);
  return node;
};
const flush = async () => {
  for (let n = 0; n < 30; n++) await Promise.resolve();
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});

function calendarFixture(props: Record<string, unknown> = {}) {
  const root = element<CalendarConsumer>(calendarRoot.name, {
    defaultValue: '2026-10-09',
    ...props,
  });
  const caption = element(calendarCaption.name);
  const previous = element(calendarPrevious.name);
  const heading = element(calendarHeading.name);
  const next = element(calendarNext.name);
  previous.textContent = 'Previous';
  next.textContent = 'Next';
  caption.append(previous, heading, next);
  const grid = element(calendarGrid.name);
  const weekdays = element(calendarWeekdays.name);
  const weekday = element(calendarWeekday.name, { offset: 0 });
  weekdays.append(weekday);
  const row = element(calendarRow.name, { index: 1 });
  const day = element<DayConsumer>(calendarDay.name, { date: '2026-10-10' });
  row.append(day);
  grid.append(weekdays, row);
  root.append(caption, grid);
  return { root, caption, previous, heading, next, grid, weekday, day };
}
const records = [
  { id: 'z', name: 'Zeta', count: 3 },
  { id: 'a', name: 'Alpha', count: 9 },
];
function tableFixture(props: Record<string, unknown> = {}) {
  const root = element<TableConsumer>(dataTableRoot.name, { rows: records, pageSize: 1, ...props });
  const head = element(dataTableHeaderRow.name);
  const name = element(dataTableHeader.name, { headerKey: 'name' });
  const count = element(dataTableHeader.name, { headerKey: 'count' });
  name.textContent = 'Name';
  count.textContent = 'Count';
  head.append(name, count);
  const row = element(dataTableRow.name, { index: 0 });
  const cell = element(dataTableCell.name, { columnKey: 'name', headers: ['name'] });
  row.append(cell, element(dataTableCell.name, { columnKey: 'count', headers: ['count'] }));
  const caption = element(dataTableCaption.name);
  caption.textContent = 'Records';
  const previous = element(dataTablePrevious.name);
  previous.textContent = 'Previous';
  const next = element(dataTableNext.name);
  next.textContent = 'Next';
  root.append(caption, head, row, previous, next);
  return { root, head, name, count, row, cell, caption, previous, next };
}
function groupFixture(props: Record<string, unknown> = {}) {
  const root = element<GroupConsumer>(toggleGroupRoot.name, { defaultValue: ['bold'], ...props });
  const bold = element<ItemConsumer>(toggleGroupItem.name, { value: 'bold' });
  const italic = element<ItemConsumer>(toggleGroupItem.name, { value: 'italic' });
  bold.textContent = 'Bold';
  italic.textContent = 'Italic';
  root.append(bold, italic);
  return { root, bold, italic };
}
function toolbarFixture(props: Record<string, unknown> = {}) {
  const root = element<ToolbarConsumer>(toolbarRoot.name, props);
  const first = element<ToolbarButtonConsumer>(toolbarButton.name, { value: 'first' });
  const disabled = element(toolbarButton.name, { value: 'disabled', disabled: true });
  const last = element(toolbarButton.name, { value: 'last' });
  const separator = element(toolbarSeparator.name);
  first.textContent = 'First';
  disabled.textContent = 'Disabled';
  last.textContent = 'Last';
  root.append(first, disabled, separator, last);
  return { root, first, disabled, separator, last };
}

// Independent retained-source geometry cases; these are exercised through real
// date, row, selection and navigation owners, not a copied production map.
const sources = [
  {
    profile: 'vega',
    cell: 'h-8',
    padding: 'p-3',
    action: 'h-9',
    toggle: 'h-9',
    head: 'h-10',
    tablePadding: 'p-2',
  },
  {
    profile: 'nova',
    cell: 'h-7',
    padding: 'p-2',
    action: 'h-8',
    toggle: 'h-8',
    head: 'h-10',
    tablePadding: 'p-2',
  },
  {
    profile: 'maia',
    cell: 'h-8',
    padding: 'p-3',
    action: 'h-9',
    toggle: 'h-9',
    head: 'h-12',
    tablePadding: 'p-3',
  },
  {
    profile: 'lyra',
    cell: 'h-7',
    padding: 'p-2',
    action: 'h-8',
    toggle: 'h-8',
    head: 'h-10',
    tablePadding: 'p-2',
  },
  {
    profile: 'mira',
    cell: 'h-6',
    padding: 'p-3',
    action: 'h-7',
    toggle: 'h-7',
    head: 'h-10',
    tablePadding: 'p-2',
  },
  {
    profile: 'luma',
    cell: 'h-8',
    padding: 'p-3',
    action: 'h-9',
    toggle: 'h-9',
    head: 'h-12',
    tablePadding: 'p-3',
  },
  {
    profile: 'sera',
    cell: 'h-8',
    padding: 'p-3',
    action: 'h-10',
    toggle: 'h-10',
    head: 'h-12',
    tablePadding: 'p-3',
  },
  {
    profile: 'rhea',
    cell: 'h-8',
    padding: 'p-3',
    action: 'h-8',
    toggle: 'h-8',
    head: 'h-10',
    tablePadding: 'p-2',
  },
  {
    profile: 'new-york-v4',
    cell: 'h-8',
    padding: 'p-3',
    action: 'h-9',
    toggle: 'h-9',
    head: 'h-10',
    tablePadding: 'p-2',
  },
];

describe('source-bound collection consumers', () => {
  it('keeps the separately content-pinned unscoped Nova Calendar default and its real month render', async () => {
    const f = calendarFixture();
    document.body.append(f.root);
    await flush();
    expect(styleContains(f.root, 'p-2')).toBe(true);
    expect(styleContains(f.day, 'h-7')).toBe(true);
    expect(styleContains(f.day, 'h-8')).toBe(false);
    const value = f.root.getExposes().value;
    f.next.click();
    await flush();
    expect(f.root.getExposes().month.get()).toBe('2026-11');
    expect(f.heading.textContent).toBe('November 2026');
    expect(f.root.getExposes().value).toBe(value);
    expect(value.get()).toBe('2026-10-09');
  });

  it.each(sources)(
    '$profile keeps live date, sorting and selection owners while projecting its own units',
    async (source) => {
      const scope = element(styleScope.name, { styleProfile: source.profile });
      const calendar = calendarFixture();
      const table = tableFixture();
      const group = groupFixture();
      const toolbar = toolbarFixture();
      scope.append(calendar.root, table.root, group.root, toolbar.root);
      document.body.append(scope);
      await flush();
      expect(styleContains(calendar.day, source.cell)).toBe(true);
      expect(styleContains(calendar.root, source.padding)).toBe(true);
      expect(styleContains(calendar.next, source.cell)).toBe(true);
      expect(styleContains(calendar.weekday, source.cell)).toBe(false); // no invented cell-height on weekday labels
      expect(calendar.weekday.getAttribute('role')).toBe('columnheader');
      expect(calendar.caption.getAttribute('aria-label')).toBe('Calendar navigation');
      expect(calendar.day.textContent).toBe('10');
      expect(calendar.heading.textContent).toBe('October 2026');
      expect(styleContains(table.name, source.head)).toBe(true);
      expect(styleContains(table.cell, source.tablePadding)).toBe(true);
      expect(table.root.getExposes().getStructure()).toMatchObject({ valid: true, columnCount: 2 });
      expect(table.head.getExposes()).toEqual({});
      expect(table.head.tabIndex).toBe(-1);
      expect(styleContains(group.bold, source.toggle)).toBe(true);
      expect(styleContains(toolbar.first, source.action)).toBe(true);
      const date = calendar.root.getExposes().value;
      const selected = group.bold.getExposes().active;
      calendar.day.click();
      table.name.click();
      group.italic.click();
      await flush();
      expect(date.get()).toBe('2026-10-10');
      expect(table.cell.textContent).toBe('Alpha');
      expect(group.root.getExposes().getValue()).toEqual(['italic']);
      expect(selected.get()).toBe(false);
      setElementProps(scope, { styleProfile: 'mira' });
      await flush();
      expect(styleContains(calendar.day, 'h-6')).toBe(true);
      if (source.cell !== 'h-6') expect(styleContains(calendar.day, source.cell)).toBe(false);
      expect(calendar.root.getExposes().value).toBe(date);
      expect(date.get()).toBe('2026-10-10');
      expect(group.bold.getExposes().active).toBe(selected);
      expect(group.root.getExposes().count.get()).toBe(2);
      expect(table.cell.textContent).toBe('Alpha');
      expect(table.root.getExposes().count.get()).toBe(1);
    }
  );

  it('withdraws explicit style and scope paint without accepting a refused Calendar value or replacing its focused day', async () => {
    const scope = element(styleScope.name, { styleProfile: 'maia' });
    const f = calendarFixture({ value: '2026-10-09', direction: 'rtl' });
    setElementProps(f.day, { date: '2026-10-10', styleProfile: 'mira' });
    scope.append(f.root);
    document.body.append(scope);
    await flush();
    const changes: unknown[] = [];
    f.root.addEventListener('valueChange', (event) => changes.push((event as CustomEvent).detail));
    const owner = f.root.getExposes().value;
    f.day.getExposes().focusSelf({ reason: 'keyboard' });
    await flush();
    expect(document.activeElement).toBe(f.day);
    expect(f.root.getExposes().direction.get()).toBe('rtl');
    expect(f.root.getAttribute('data-direction')).toBe('rtl');
    f.day.click();
    await flush();
    expect(changes).toEqual([{ value: '2026-10-10' }]);
    expect(owner.get()).toBe('2026-10-09');
    expect(f.day.getExposes().selected.get()).toBe(false);
    setElementProps(f.day, { date: '2026-10-10' });
    await flush();
    expect(styleContains(f.day, 'h-8')).toBe(true);
    expect(styleContains(f.day, 'h-6')).toBe(false);
    expect(document.activeElement).toBe(f.day);
    expect(f.root.getExposes().value).toBe(owner);
    setElementProps(f.root, { value: '2026-10-10', styleProfile: 'lyra', direction: 'rtl' });
    await flush();
    expect(f.day.getExposes().selected.get()).toBe(true);
    expect(styleContains(f.day, 'h-7')).toBe(true);
    expect(styleContains(f.day, 'rounded-none')).toBe(true);
    setElementProps(f.root, { value: '2026-10-10', readOnly: true, direction: 'rtl' });
    await flush();
    expect(styleContains(f.day, 'h-8')).toBe(true);
    expect(styleContains(f.day, 'rounded-none')).toBe(false);
    expect(f.root.getExposes().requestValue('2026-10-11')).toBe(false);
    expect(changes).toHaveLength(1);
    setElementProps(f.root, { value: '2026-10-10', disabled: true });
    await flush();
    f.next.click();
    f.day.click();
    await flush();
    expect(f.root.getExposes().month.get()).toBe('2026-10');
    expect(changes).toHaveLength(1);
    expect(f.day.getAttribute('aria-disabled')).toBe('true');
  });

  it('preserves distinct DatePicker date/open refusals, inherited day render and one Calendar owner', async () => {
    const root = element<DatePickerConsumer>(datePickerRoot.name, {
      value: '2026-10-09',
      open: true,
      direction: 'rtl',
      styleProfile: 'nova',
    });
    const trigger = element(datePickerTrigger.name);
    const value = element(datePickerValue.name);
    const content = element(datePickerContent.name);
    const grid = element(calendarGrid.name);
    const row = element(calendarRow.name, { index: 1 });
    const day = element<DayConsumer>(datePickerDay.name, { date: '2026-10-10' });
    trigger.append(value);
    row.append(day);
    grid.append(row);
    content.append(grid);
    root.append(trigger, content);
    const values: unknown[] = [];
    const opens: unknown[] = [];
    root.addEventListener('valueChange', (event) => values.push((event as CustomEvent).detail));
    root.addEventListener('openChange', (event) => opens.push((event as CustomEvent).detail));
    document.body.append(root);
    await flush();
    const dateOwner = root.getExposes().value;
    const openOwner = root.getExposes().open;
    expect(day.textContent).toBe('10');
    expect(value.textContent).toBe('2026-10-09');
    expect(styleContains(content, 'p-2')).toBe(true);
    expect(root.getExposes().direction.get()).toBe('rtl');
    expect(root.getAttribute('data-direction')).toBe('rtl');
    day.click();
    await flush();
    expect(values).toEqual([{ value: '2026-10-10' }]);
    expect(opens).toEqual([expect.objectContaining({ open: false, reason: 'date-selection' })]);
    expect(dateOwner.get()).toBe('2026-10-09');
    expect(openOwner.get()).toBe(true);
    setElementProps(root, { value: '2026-10-10', open: true, styleProfile: 'rhea' });
    await flush();
    expect(root.getExposes().value).toBe(dateOwner);
    expect(root.getExposes().open).toBe(openOwner);
    expect(day.getExposes().selected.get()).toBe(true);
    expect(styleContains(content, 'p-3')).toBe(true);
    expect(styleContains(content, 'p-2')).toBe(false);
    expect(styleContains(day, 'h-8')).toBe(true);
    expect(value.textContent).toBe('2026-10-10');
    setElementProps(root, {
      value: '2026-10-10',
      open: true,
      readOnly: true,
      styleProfile: 'new-york',
    });
    await flush();
    day.click();
    await flush();
    expect(values).toHaveLength(1);
    expect(opens).toHaveLength(1);
    root.getExposes().close('test-request');
    await flush();
    expect(openOwner.get()).toBe(true);
    expect(opens).toHaveLength(2);
  });

  it('keeps passive HeaderRow and independent controlled sort, page and selection requests through source withdrawal', async () => {
    const props = {
      sortKey: '',
      sortDirection: 'none',
      selectedKeys: [],
      page: 0,
      styleProfile: 'sera',
    };
    const f = tableFixture(props);
    document.body.append(f.root);
    await flush();
    const sorts: unknown[] = [];
    const pages: unknown[] = [];
    const selections: unknown[] = [];
    f.root.addEventListener('sortChange', (event) => sorts.push((event as CustomEvent).detail));
    f.root.addEventListener('pageChange', (event) => pages.push((event as CustomEvent).detail));
    f.root.addEventListener('selectionChange', (event) =>
      selections.push((event as CustomEvent).detail)
    );
    const count = f.root.getExposes().count;
    const before = f.root.getExposes().getStructure();
    f.head.click();
    await flush();
    expect(sorts).toEqual([]);
    expect(selections).toEqual([]);
    f.name.click();
    f.next.click();
    f.row.click();
    await flush();
    expect(sorts).toEqual([{ sortKey: 'name', sortDirection: 'ascending' }]);
    expect(pages).toEqual([{ page: 1 }]);
    expect(selections).toEqual([{ selectedKeys: ['z'] }]);
    expect(
      f.root
        .getExposes()
        .getRows()
        .map((record) => record.id)
    ).toEqual(['z']);
    expect(f.name.getAttribute('aria-sort')).toBe('none');
    expect(f.row.getAttribute('aria-selected')).toBe('false');
    setElementProps(f.root, {
      rows: records,
      pageSize: 1,
      ...props,
      sortKey: 'name',
      sortDirection: 'ascending',
      selectedKeys: ['z'],
      styleProfile: 'nova',
    });
    await flush();
    expect(styleContains(f.name, 'uppercase')).toBe(false);
    expect(styleContains(f.name, 'h-12')).toBe(false);
    expect(styleContains(f.name, 'h-10')).toBe(true);
    expect(f.cell.textContent).toBe('Alpha');
    expect(f.root.getExposes().getStructure()).toMatchObject({
      valid: true,
      rowCount: before.rowCount,
      columnCount: 2,
    });
    expect(f.root.getExposes().count).toBe(count);
    expect(f.head.getExposes()).toEqual({});
    expect(f.head.getAttribute('aria-selected')).toBeNull();
    expect(f.head.tabIndex).toBe(-1);
    setElementProps(f.root, {
      rows: records,
      pageSize: 1,
      page: 1,
      styleProfile: 'mira',
      disabled: true,
    });
    await flush();
    expect(f.cell.textContent).toBe('Zeta');
    f.count.click();
    f.previous.click();
    f.row.click();
    await flush();
    expect(sorts).toHaveLength(1);
    expect(pages).toHaveLength(1);
    expect(selections).toHaveLength(1);
  });

  it('retains embedded Tree selection and refused expansion while withdrawing profile/appearance and pointer paint', async () => {
    const props = {
      appearance: 'embedded',
      value: 'src/file',
      expandedKeys: ['src'],
      styleProfile: 'sera',
    };
    const root = element<TreeConsumer>(treeRoot.name, props);
    const folder = element(treeItem.name, {
      appearance: 'embedded',
      nodeKey: 'src',
      textValue: 'Source',
    });
    folder.textContent = 'Source';
    const group = element(treeGroup.name, { nodeKey: 'src' });
    const file = element(treeItem.name, {
      appearance: 'embedded',
      nodeKey: 'src/file',
      parentKey: 'src',
      textValue: 'File',
    });
    file.textContent = 'File';
    const toggle = element(treeToggle.name, { nodeKey: 'src' });
    toggle.textContent = 'Expand source';
    group.append(file);
    root.append(folder, toggle, group);
    document.body.append(root);
    await flush();
    const value = root.getExposes().value;
    const expands: unknown[] = [];
    const selections: unknown[] = [];
    root.addEventListener('expandedChange', (event) => expands.push((event as CustomEvent).detail));
    root.addEventListener('valueChange', (event) => selections.push((event as CustomEvent).detail));
    toggle.click();
    folder.click();
    await flush();
    expect(expands).toEqual([{ expandedKeys: [] }]);
    expect(root.getExposes().getExpandedKeys()).toEqual(['src']);
    expect(selections).toEqual([{ value: 'src' }]);
    expect(value.get()).toBe('src/file');
    expect(file.getAttribute('aria-selected')).toBe('true');
    expect(file.getAttribute('aria-level')).toBe('2');
    expect(styleContains(file, 'uppercase')).toBe(true);
    expect(styleContains(file, 'rounded-none')).toBe(true);
    setElementProps(root, { ...props, styleProfile: 'nova' });
    await flush();
    expect(styleContains(file, 'uppercase')).toBe(false);
    expect(styleContains(file, 'text-sm')).toBe(true);
    expect(root.getExposes().value).toBe(value);
    expect(group.contains(file)).toBe(true);
    folder.dispatchEvent(new PointerEvent('pointerenter'));
    await flush();
    setElementProps(folder, { appearance: 'default', nodeKey: 'src', textValue: 'Source' });
    await flush();
    expect(styleContains(folder, 'bg-muted-foreground/15')).toBe(false);
    setElementProps(root, {
      ...props,
      value: 'src',
      expandedKeys: [],
      disabled: true,
      styleProfile: 'mira',
    });
    await flush();
    expect(file.getAttribute('aria-hidden')).toBe('true');
    expect(root.getExposes().requestExpanded('src', true)).toBe(false);
    toggle.click();
    await flush();
    expect(expands).toHaveLength(1);
  });

  it('uses logical ToggleGroup membership for joined edges, not values or DOM sibling positions', async () => {
    const f = groupFixture({ value: ['bold'], styleProfile: 'new-york-v4' });
    const wrapper = document.createElement('div');
    wrapper.append(f.italic);
    f.root.append(wrapper);
    document.body.append(f.root);
    await flush();
    const active = f.bold.getExposes().active;
    const requests: unknown[] = [];
    f.root.addEventListener('valueChange', (event) => requests.push((event as CustomEvent).detail));
    expect(styleContains(f.bold, 'rounded-l-md')).toBe(true);
    expect(styleContains(f.italic, 'rounded-r-md')).toBe(true);
    f.italic.click();
    await flush();
    expect(requests).toEqual([{ value: ['italic'] }]);
    expect(f.root.getExposes().getValue()).toEqual(['bold']);
    expect(active.get()).toBe(true);
    setElementProps(f.root, {
      value: ['bold'],
      styleProfile: 'new-york-v4',
      orientation: 'vertical',
    });
    await flush();
    expect(styleContains(f.bold, 'rounded-l-md')).toBe(false);
    expect(styleContains(f.bold, 'rounded-t-md')).toBe(true);
    expect(styleContains(f.italic, 'rounded-b-md')).toBe(true);
    setElementProps(f.root, { value: ['italic'], styleProfile: 'mira', orientation: 'horizontal' });
    await flush();
    expect(styleContains(f.bold, 'rounded-t-md')).toBe(false);
    expect(styleContains(f.italic, 'rounded-b-md')).toBe(false);
    expect(styleContains(f.italic, 'h-7')).toBe(true);
    expect(f.bold.getExposes().active).toBe(active);
    expect(active.get()).toBe(false);
    setElementProps(f.root, { value: ['italic'], styleProfile: 'new-york-v4' });
    await flush();
    f.bold.remove();
    await flush();
    expect(styleContains(f.italic, 'rounded-l-md')).toBe(true);
    expect(styleContains(f.italic, 'rounded-r-md')).toBe(true);
    expect(f.root.getExposes().count.get()).toBe(1);
    setElementProps(f.root, { value: ['italic'], disabled: true, styleProfile: 'sera' });
    await flush();
    f.italic.click();
    await flush();
    expect(requests).toHaveLength(1);
  });

  it('withdraws default ToggleGroup hover paint on disable, cancellation and remount without selecting the hovered item', async () => {
    const f = groupFixture({ styleProfile: 'mira' });
    document.body.append(f.root);
    await flush();
    f.italic.dispatchEvent(new PointerEvent('pointerenter'));
    await flush();
    expect(styleContains(f.italic, 'bg-muted')).toBe(true);
    expect(f.root.getExposes().getValue()).toEqual(['bold']);
    setElementProps(f.italic, { value: 'italic', disabled: true });
    await flush();
    expect(styleContains(f.italic, 'bg-muted')).toBe(false);
    setElementProps(f.italic, { value: 'italic' });
    await flush();
    expect(styleContains(f.italic, 'bg-muted')).toBe(false);
    f.italic.dispatchEvent(new PointerEvent('pointerenter'));
    f.italic.dispatchEvent(new PointerEvent('pointercancel'));
    await flush();
    expect(styleContains(f.italic, 'bg-muted')).toBe(false);
    f.italic.dispatchEvent(new PointerEvent('pointerenter'));
    await flush();
    f.italic.remove();
    await flush();
    f.root.append(f.italic);
    await flush();
    expect(styleContains(f.italic, 'bg-muted')).toBe(false);
    expect(f.root.getExposes().getValue()).toEqual(['bold']);
    expect(f.root.getExposes().count.get()).toBe(2);
  });

  it('keeps Toolbar navigation, passive cross-axis Separator and one action route through profile changes and disable', async () => {
    const f = toolbarFixture({ styleProfile: 'mira' });
    document.body.append(f.root);
    await flush();
    const disabled = f.first.getExposes().disabled;
    const actions: unknown[] = [];
    f.last.addEventListener('action', (event) => actions.push((event as CustomEvent).detail));
    f.root.getExposes().focusFirst();
    await flush();
    expect(document.activeElement).toBe(f.first);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await flush();
    expect(document.activeElement).toBe(f.last);
    expect(f.disabled.tabIndex).toBe(-1);
    expect(f.separator.getAttribute('aria-orientation')).toBe('vertical');
    expect(f.separator.getExposes()).toEqual({});
    setElementProps(f.root, { styleProfile: 'sera', orientation: 'vertical' });
    await flush();
    expect(f.first.getExposes().disabled).toBe(disabled);
    expect(styleContains(f.first, 'h-10')).toBe(true);
    expect(styleContains(f.first, 'h-7')).toBe(false);
    expect(f.separator.getAttribute('aria-orientation')).toBe('horizontal');
    expect(styleContains(f.separator, 'h-px')).toBe(true);
    expect(styleContains(f.separator, 'w-px')).toBe(false);
    f.root.getExposes().focusFirst();
    await flush();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await flush();
    expect(document.activeElement).toBe(f.last);
    f.last.click();
    await flush();
    expect(actions).toEqual([{ value: 'last' }]);
    setElementProps(f.root, { styleProfile: 'nova', disabled: true });
    await flush();
    expect(styleContains(f.first, 'uppercase')).toBe(false);
    expect(disabled.get()).toBe(true);
    expect(f.separator.getAttribute('aria-orientation')).toBe('vertical');
    expect(styleContains(f.separator, 'h-px')).toBe(false);
    f.last.click();
    await flush();
    expect(actions).toHaveLength(1);
  });
});
