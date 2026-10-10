import type {
  DataTableRootProps,
  DataTableRootExposes,
  DataTableRootAsHookContract,
  DataTableRowProps,
  DataTableRowExposes,
  DataTableRowAsHookContract,
  DataTableCellProps,
  DataTableCellExposes,
  DataTableCellAsHookContract,
  DataTableHeaderProps,
  DataTableHeaderExposes,
  DataTableHeaderAsHookContract,
  DataTableCaptionProps,
  DataTableCaptionExposes,
  DataTableCaptionAsHookContract,
  DataTablePreviousProps,
  DataTablePreviousExposes,
  DataTablePreviousAsHookContract,
  DataTableNextProps,
  DataTableNextExposes,
  DataTableNextAsHookContract,
} from './types';
export type * from './types';
import {
  createAnatomyFamily,
  createContextKey,
  defineAsHook,
  definePrototype,
  tw,
  type DefHandle,
  type RunHandle,
} from '@proto.ui/core';
import {
  asAccessible,
  asCollection,
  asCollectionItem,
  asFocusable,
  asTrigger,
} from '@proto.ui/hooks';
import { asButton } from '../button';
import { callOwner } from '../collection-controls/shared';
import { tableRoot, tableRow, tableCell, tableHeaderCell, tableCaption } from '../table';
import { dataView, type DataRecord, type SortDirection } from './model';
export * from './model';
// These hooks inherit the actual passive Table setups; data operations do not change Table ownership.
const tableRootBehavior = defineAsHook({
  name: 'as-data-table-structure-root',
  setup: tableRoot.setup,
});
const tableRowBehavior = defineAsHook({
  name: 'as-data-table-structure-row',
  setup: tableRow.setup,
});
const tableCellBehavior = defineAsHook({
  name: 'as-data-table-structure-cell',
  setup: tableCell.setup,
});
const tableHeaderBehavior = defineAsHook({
  name: 'as-data-table-structure-header',
  setup: tableHeaderCell.setup,
});
const tableCaptionBehavior = defineAsHook({
  name: 'as-data-table-structure-caption',
  setup: tableCaption.setup,
});
export const DATA_TABLE_FAMILY = createAnatomyFamily('base-data-table', {
  roles: {
    root: { cardinality: { min: 1, max: 1 } },
    row: { cardinality: { min: 0, max: '*' } },
    header: { cardinality: { min: 0, max: '*' } },
    cell: { cardinality: { min: 0, max: '*' } },
    previous: { cardinality: { min: 0, max: 1 } },
    next: { cardinality: { min: 0, max: 1 } },
  },
});
export const DATA_TABLE_CONTEXT = createContextKey<{
  revision: number;
  sortKey: string;
  sortDirection: SortDirection;
  selectedKeys: string[];
  disabled: boolean;
  readOnly: boolean;
  page: number;
  pageCount: number;
}>('base-data-table');
export const DATA_TABLE_ROW_CONTEXT = createContextKey<{ rowKey: string }>('base-data-table-row');
function setupRoot(def: DefHandle<DataTableRootProps, DataTableRootExposes>) {
  tableRootBehavior();
  def.anatomy.claim(DATA_TABLE_FAMILY, { role: 'root' });
  asCollection().configure({ family: DATA_TABLE_FAMILY, itemRole: 'row' });
  const stringArray = (value: unknown) => {
    if (!Array.isArray(value)) return false;
    for (let index = 0; index < value.length; index++)
      if (!Object.hasOwn(value, index) || typeof value[index] !== 'string') return false;
    return true;
  };
  def.props.define({
    rows: { type: 'object' },
    sortKey: { type: 'string' },
    defaultSortKey: { type: 'string' },
    sortDirection: { type: 'enum', options: ['none', 'ascending', 'descending'] },
    defaultSortDirection: { type: 'enum', options: ['none', 'ascending', 'descending'] },
    filter: { type: 'string' },
    page: { type: 'number' },
    defaultPage: { type: 'number' },
    pageSize: { type: 'number' },
    selectedKeys: { type: 'object', validator: stringArray, empty: 'fallback' },
    defaultSelectedKeys: { type: 'object', validator: stringArray, empty: 'fallback' },
    disabled: { type: 'boolean' },
    readOnly: { type: 'boolean' },
  });
  def.props.setDefaults({
    rows: [],
    defaultSortKey: '',
    defaultSortDirection: 'none',
    filter: '',
    defaultPage: 0,
    pageSize: 10,
    defaultSelectedKeys: [],
    disabled: false,
    readOnly: false,
  });
  def.context.provide(DATA_TABLE_CONTEXT, {
    revision: 0,
    sortKey: '',
    sortDirection: 'none',
    selectedKeys: [],
    disabled: false,
    readOnly: false,
    page: 0,
    pageCount: 1,
  });
  def.context.subscribe(DATA_TABLE_CONTEXT);
  let owner: RunHandle<DataTableRootProps> | null = null,
    sortKey = '',
    sortDirection: SortDirection = 'none',
    page = 0,
    selected: string[] = [],
    view = dataView([]);
  const rowCount = def.state.numberDiscrete('filteredCount', 0);
  def.expose.state('filteredCount', rowCount);
  for (const name of ['sortChange', 'pageChange', 'selectionChange'] as const)
    def.expose.event(name, { payload: 'json' });
  const publish = (run: RunHandle<DataTableRootProps>) => {
    const p = run.props.get();
    view = dataView(p.rows ?? [], {
      sortKey,
      sortDirection,
      filter: p.filter,
      page,
      pageSize: p.pageSize,
    });
    page = view.page;
    rowCount.set(view.filteredCount, 'data table filtered rows');
    const c = run.context.read(DATA_TABLE_CONTEXT);
    run.context.update(DATA_TABLE_CONTEXT, {
      revision: c.revision + 1,
      sortKey,
      sortDirection,
      selectedKeys: [...selected],
      disabled: !!p.disabled,
      readOnly: !!p.readOnly,
      page,
      pageCount: view.pageCount,
    });
  };
  def.expose.method('getRows', () => view.rows.map((row) => ({ ...row })));
  def.expose.method(
    'getRecord',
    (id: string) => owner?.props.get().rows?.find((row) => row.id === id) ?? null
  );
  def.expose.method('requestSort', (key: string) => {
    if (!owner || owner.props.get().disabled || !key) return false;
    const direction: SortDirection =
      sortKey !== key || sortDirection === 'none'
        ? 'ascending'
        : sortDirection === 'ascending'
          ? 'descending'
          : 'none';
    if (!owner.props.isProvided('sortKey')) sortKey = key;
    if (!owner.props.isProvided('sortDirection')) sortDirection = direction;
    publish(owner);
    owner.expose.emit('sortChange', { sortKey: key, sortDirection: direction });
    return true;
  });
  def.expose.method('requestPage', (next: number) => {
    if (!owner || owner.props.get().disabled || !Number.isFinite(next)) return false;
    next = Math.max(0, Math.min(view.pageCount - 1, Math.trunc(next)));
    if (next === page) return false;
    if (!owner.props.isProvided('page')) page = next;
    publish(owner);
    owner.expose.emit('pageChange', { page: next });
    return true;
  });
  def.expose.method('requestSelection', (id: string) => {
    if (
      !owner ||
      owner.props.get().disabled ||
      owner.props.get().readOnly ||
      !owner.props.get().rows?.some((row) => row.id === id)
    )
      return false;
    const next = selected.includes(id) ? selected.filter((key) => key !== id) : [...selected, id];
    if (!owner.props.isProvided('selectedKeys')) selected = next;
    publish(owner);
    owner.expose.emit('selectionChange', { selectedKeys: next });
    return true;
  });
  const sync = (run: RunHandle<DataTableRootProps>, created = false) => {
    owner = run;
    const p = run.props.get();
    if (created || run.props.isProvided('sortKey'))
      sortKey = (run.props.isProvided('sortKey') ? p.sortKey : p.defaultSortKey) ?? '';
    if (created || run.props.isProvided('sortDirection'))
      sortDirection =
        (run.props.isProvided('sortDirection') ? p.sortDirection : p.defaultSortDirection) ??
        'none';
    if (created || run.props.isProvided('page'))
      page = (run.props.isProvided('page') ? p.page : p.defaultPage) ?? 0;
    if (created || run.props.isProvided('selectedKeys'))
      selected = [
        ...((run.props.isProvided('selectedKeys') ? p.selectedKeys : p.defaultSelectedKeys) ?? []),
      ];
    publish(run);
  };
  def.lifecycle.onCreated((run) => sync(run, true));
  def.lifecycle.onMounted((run) => sync(run));
  def.props.watchAll((run) => sync(run));
  def.lifecycle.onUnmounted(() => {
    owner = null;
  });
}
export const asDataTableRoot = defineAsHook<
  DataTableRootProps,
  DataTableRootExposes,
  DataTableRootAsHookContract
>({ name: 'as-data-table-root', setup: setupRoot });
export const dataTableRoot = definePrototype({ name: 'base-data-table-root', setup: setupRoot });
function setupRow(def: DefHandle<DataTableRowProps, DataTableRowExposes>) {
  tableRowBehavior();
  asCollectionItem().configure({
    family: DATA_TABLE_FAMILY,
    role: 'row',
    getMeta: () => ({ value: key.get() }),
  });
  def.props.define({ index: { type: 'number' }, header: { type: 'boolean' } });
  def.props.setDefaults({ index: 0, header: false });
  def.context.provide(DATA_TABLE_ROW_CONTEXT, { rowKey: '' });
  const key = def.state.string('rowKey', ''),
    selected = def.state.bool('selected', false),
    hidden = def.state.bool('hidden', false);
  def.expose.state('rowKey', key);
  def.expose.state('selected', selected);
  const a = asAccessible();
  a.state('selected', selected);
  a.state('hidden', hidden);
  const focus = asFocusable<DataTableRowProps>();
  focus.configure({ disabled: false });
  def.expose.state('focused', focus.focused);
  def.expose.state('focusVisible', focus.focusVisible);
  def.event.on('key.down', (_run, event) => {
    if (focus.focused.get() && event.key === ' ')
      event.control.requestDefaultActionPrevention({
        reason: 'data-table.row-selection',
        source: 'base-data-table-row',
      });
  });
  asTrigger();
  const sync = (run: RunHandle<DataTableRowProps>) => {
    const c = run.context.read(DATA_TABLE_CONTEXT),
      p = run.props.get(),
      rows = callOwner(run, DATA_TABLE_FAMILY, 'getRows') as DataRecord[];
    const row = rows[Math.trunc(p.index ?? 0)],
      id = p.header ? '' : (row?.id ?? '');
    key.set(id, 'data row slot identity');
    selected.set(!!id && c.selectedKeys.includes(id), 'data row selection');
    hidden.set(!p.header && !row, 'data row empty slot');
    run.lifecycle.setPresent(!hidden.get());
    focus.setDisabled(!!p.header || c.disabled || hidden.get());
    run.context.update(DATA_TABLE_ROW_CONTEXT, { rowKey: id });
  };
  def.context.subscribe(DATA_TABLE_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  def.props.watchAll(sync);
  def.rule({
    when: (w) => w.state(hidden).eq(true),
    intent: (i) => i.feedback.style.use(tw('hidden')),
  });
  def.event.on('press.commit', (run) => {
    if (key.get()) callOwner(run, DATA_TABLE_FAMILY, 'requestSelection', key.get());
  });
}
export const asDataTableRow = defineAsHook<
  DataTableRowProps,
  DataTableRowExposes,
  DataTableRowAsHookContract
>({ name: 'as-data-table-row', setup: setupRow });
export const dataTableRow = definePrototype({ name: 'base-data-table-row', setup: setupRow });
function setupCell(def: DefHandle<DataTableCellProps, DataTableCellExposes>) {
  tableCellBehavior();
  def.props.define({ columnKey: { type: 'string' } });
  def.props.setDefaults({ columnKey: '' });
  def.context.subscribe(DATA_TABLE_CONTEXT);
  const value = def.state.string('displayValue', '');
  def.expose.state('displayValue', value);
  let mounted = false;
  const sync = (run: RunHandle<DataTableCellProps>) => {
    const id = run.context.read(DATA_TABLE_ROW_CONTEXT).rowKey;
    const row = callOwner(run, DATA_TABLE_FAMILY, 'getRecord', id) as DataRecord | null;
    const next = String(row?.[run.props.get().columnKey ?? ''] ?? '');
    if (next !== value.get()) {
      value.set(next, 'data table cell value');
      if (mounted) run.update();
    }
  };
  def.context.subscribe(DATA_TABLE_ROW_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  def.lifecycle.onMounted((run) => {
    mounted = true;
    sync(run);
    run.update();
  });
  def.props.watchAll(sync);
  def.lifecycle.onUnmounted(() => {
    mounted = false;
  });
  return () => [value.get()];
}
export const asDataTableCell = defineAsHook<
  DataTableCellProps,
  DataTableCellExposes,
  DataTableCellAsHookContract
>({ name: 'as-data-table-cell', setup: setupCell });
export const dataTableCell = definePrototype({ name: 'base-data-table-cell', setup: setupCell });
function setupHeader(def: DefHandle<DataTableHeaderProps, DataTableHeaderExposes>) {
  tableHeaderBehavior();
  def.props.define({ sortable: { type: 'boolean' } });
  def.props.setDefaults({ sortable: true, headerKind: 'column' });
  const focus = asFocusable<DataTableHeaderProps>();
  focus.configure({ disabled: false });
  asTrigger();
  const sort = def.state.string('sort', 'none');
  def.expose.state('sort', sort);
  asAccessible().state('sort', sort);
  const sync = (run: RunHandle<DataTableHeaderProps>) => {
    const c = run.context.read(DATA_TABLE_CONTEXT);
    sort.set(c.sortKey === run.props.get().headerKey ? c.sortDirection : 'none', 'column sort');
    focus.setDisabled(c.disabled || !run.props.get().sortable);
  };
  def.context.subscribe(DATA_TABLE_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  def.props.watchAll(sync);
  def.event.on('press.commit', (run) => {
    if (run.props.get().sortable)
      callOwner(run, DATA_TABLE_FAMILY, 'requestSort', run.props.get().headerKey);
  });
}
export const asDataTableHeader = defineAsHook<
  DataTableHeaderProps,
  DataTableHeaderExposes,
  DataTableHeaderAsHookContract
>({ name: 'as-data-table-header', setup: setupHeader });
export const dataTableHeader = definePrototype({
  name: 'base-data-table-header',
  setup: setupHeader,
});
function setupCaption(_def: DefHandle<DataTableCaptionProps, DataTableCaptionExposes>) {
  tableCaptionBehavior();
}
export const asDataTableCaption = defineAsHook<
  DataTableCaptionProps,
  DataTableCaptionExposes,
  DataTableCaptionAsHookContract
>({
  name: 'as-data-table-caption',
  setup: setupCaption,
});
export const dataTableCaption = definePrototype({
  name: 'base-data-table-caption',
  setup: setupCaption,
});
function pageControl(delta: number) {
  return (def: DefHandle<DataTablePreviousProps, DataTablePreviousExposes>) => {
    asButton();
    def.anatomy.claim(DATA_TABLE_FAMILY, { role: delta < 0 ? 'previous' : 'next' });
    def.context.subscribe(DATA_TABLE_CONTEXT);
    def.event.on('press.commit', (run) => {
      const c = run.context.read(DATA_TABLE_CONTEXT);
      callOwner(run, DATA_TABLE_FAMILY, 'requestPage', c.page + delta);
    });
  };
}
export const asDataTablePrevious = defineAsHook<
  DataTablePreviousProps,
  DataTablePreviousExposes,
  DataTablePreviousAsHookContract
>({
  name: 'as-data-table-previous',
  setup: pageControl(-1),
});
export const dataTablePrevious = definePrototype({
  name: 'base-data-table-previous',
  setup: pageControl(-1),
});
export const asDataTableNext = defineAsHook<
  DataTableNextProps,
  DataTableNextExposes,
  DataTableNextAsHookContract
>({ name: 'as-data-table-next', setup: pageControl(1) });
export const dataTableNext = definePrototype({
  name: 'base-data-table-next',
  setup: pageControl(1),
});
