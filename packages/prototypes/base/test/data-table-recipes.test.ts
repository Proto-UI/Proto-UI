import { afterEach, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  dataTableRoot,
  dataTableRow,
  dataTableCell,
  dataTableHeader,
  dataTableHeaderRow,
  dataView,
} from '../src/data-table';
for (const p of [dataTableRoot, dataTableRow, dataTableCell, dataTableHeader, dataTableHeaderRow])
  AdaptToWebComponent(p, { registerAs: `recipe-${p.name}` });
const flush = async () => {
  for (let i = 0; i < 32; i++) await Promise.resolve();
};
const rows = [
  { id: 'a', name: 'Alpha', state: 'ready' },
  { id: 'b', name: 'Beta', state: 'busy' },
  { id: 'c', name: 'Gamma', state: 'ready' },
];
const create = (part: string, props: object = {}) => {
  const element = document.createElement(`recipe-base-data-table-${part}`) as any;
  setElementProps(element, props);
  return element;
};
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
async function fixture(props = {}) {
  const root = create('root', { rows, pageSize: 2, ...props });
  const head = create('header-row');
  const headers = ['name', 'state'].map((headerKey) => {
    const node = create('header', { headerKey });
    node.textContent = headerKey;
    return node;
  });
  head.append(...headers);
  const body = [0, 1].map((index) => {
    const row = create('row', { index });
    row.append(
      ...['name', 'state'].map((columnKey) => create('cell', { columnKey, headers: [columnKey] }))
    );
    return row;
  });
  root.append(head, ...body);
  document.body.append(root);
  await flush();
  return { root, headers, body };
}
it('combines column and global filters before pagination', () => {
  expect(
    dataView(rows, {
      filter: 'a',
      columnFilters: { state: ' READY ' },
      pageSize: 1,
      page: 1,
    }).rows.map((row) => row.id)
  ).toEqual(['c']);
  expect(
    dataView(rows, { columnFilters: { state: 'ready', name: 'alpha' } }).rows.map((row) => row.id)
  ).toEqual(['a']);
  expect(dataView(rows, { columnFilters: { absent: 'x' } }).rows).toEqual([]);
});
it('selects the current page once, preserves off-page selection, and derives mixed state', async () => {
  const { root, body } = await fixture({ defaultSelectedKeys: ['c', 'a'] });
  const changes: unknown[] = [];
  root.addEventListener('selectionChange', (e: CustomEvent) => changes.push(e.detail));
  expect(root.getExposes().pageSelection.get()).toBe('some');
  expect(root.getExposes().requestPageSelection(true)).toBe(true);
  await flush();
  expect(changes).toEqual([{ selectedKeys: ['c', 'a', 'b'] }]);
  expect(root.getExposes().pageSelection.get()).toBe('all');
  expect(body.every((row) => row.getExposes().selected.get())).toBe(true);
  expect(root.getExposes().requestPageSelection(true)).toBe(false);
  expect(root.getExposes().requestPageSelection()).toBe(true);
  await flush();
  expect(root.getExposes().getSelectedKeys()).toEqual(['c']);
  expect(root.getExposes().pageSelection.get()).toBe('none');
  root.getExposes().requestPage(1);
  await flush();
  expect(root.getExposes().pageSelection.get()).toBe('all');
});
it('keeps page selection controlled, readOnly and empty-page requests bounded', async () => {
  const { root, body } = await fixture({ selectedKeys: [] });
  const changes: unknown[] = [];
  root.addEventListener('selectionChange', (e: CustomEvent) => changes.push(e.detail));
  expect(root.getExposes().requestPageSelection(true)).toBe(true);
  await flush();
  expect(changes).toEqual([{ selectedKeys: ['a', 'b'] }]);
  expect(root.getExposes().pageSelection.get()).toBe('none');
  expect(body.every((row) => !row.getExposes().selected.get())).toBe(true);
  setElementProps(root, { rows, pageSize: 2, selectedKeys: ['a', 'b'], readOnly: true });
  await flush();
  expect(root.getExposes().requestPageSelection(false)).toBe(false);
  setElementProps(root, { rows, pageSize: 2, filter: 'absent' });
  await flush();
  expect(root.getExposes().requestPageSelection(true)).toBe(false);
});
it('hides columns while retaining logical coordinates, authored children and instance identity', async () => {
  const { root, headers, body } = await fixture();
  expect(root.getExposes().getStructure()).toMatchObject({ valid: true, columnCount: 2 });
  const relation = body[0].children[1].getAttribute('aria-labelledby');
  setElementProps(root, { rows, pageSize: 2, columnVisibility: { state: false } });
  await flush();
  expect(headers[1].getAttribute('aria-hidden')).toBe('true');
  expect(headers[1].getAttribute('data-pui-style')).toContain('hidden');
  expect(headers[1].tabIndex).toBe(-1);
  const cell = body[0].children[1];
  expect(cell.getAttribute('aria-hidden')).toBe('true');
  expect(cell.getAttribute('data-pui-style')).toContain('hidden');
  expect(cell.getAttribute('aria-labelledby')).toBe(relation);
  expect(relation.split(' ')).toContain(headers[1].id);
  expect(root.getExposes().getStructure()).toMatchObject({ valid: true, columnCount: 2 });
  expect(cell.textContent).toBe('ready');
  setElementProps(root, { rows, pageSize: 2, columnVisibility: { state: true } });
  await flush();
  expect(root.getExposes().getStructure()).toMatchObject({ valid: true, columnCount: 2 });
  expect(body[0].children[1]).toBe(cell);
  expect(headers[1].getAttribute('aria-hidden')).toBe('false');
  expect(body[0].textContent).toBe('Alphaready');
});
it('updates same-key record replacements and retains authored custom-cell children', async () => {
  const { root, body } = await fixture();
  const cell = body[0].children[0];
  const custom = document.createElement('strong');
  custom.textContent = 'Application label';
  setElementProps(cell, { columnKey: 'name', headers: ['name'], renderValue: false });
  cell.append(custom);
  await flush();
  expect(cell.textContent).toBe('Application label');
  setElementProps(root, { rows: [{ ...rows[0], name: 'Changed' }, ...rows.slice(1)], pageSize: 2 });
  await flush();
  expect(cell.getExposes().displayValue.get()).toBe('Changed');
  expect(cell.contains(custom)).toBe(true);
  expect(body[0].children[1].textContent).toBe('ready');
});
it('prevents focused header Space scrolling and delivers exactly one portable activation', async () => {
  const { root, headers } = await fixture();
  const changes: unknown[] = [];
  root.addEventListener('sortChange', (e: CustomEvent) => changes.push(e.detail));
  headers[0].focus();
  await flush();
  const down = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
  headers[0].dispatchEvent(down);
  headers[0].dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
  await flush();
  expect(down.defaultPrevented).toBe(true);
  expect(changes).toEqual([{ sortKey: 'name', sortDirection: 'ascending' }]);
  expect(headers[0].getAttribute('data-pui-a11y-actions')).toBe('activate');
});
it('keeps row activation exact-once, refuses controlled selection and leaves readOnly Space unclaimed', async () => {
  const { root, body } = await fixture({ selectedKeys: [] });
  const changes: unknown[] = [];
  root.addEventListener('selectionChange', (event: CustomEvent) => changes.push(event.detail));
  const row = body[0];
  row.focus();
  await flush();
  for (const key of ['Enter', ' ']) {
    const before = changes.length;
    const down = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    row.dispatchEvent(down);
    row.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
    await flush();
    expect(changes).toHaveLength(before + 1);
    expect(changes.at(-1)).toEqual({ selectedKeys: ['a'] });
    if (key === ' ') expect(down.defaultPrevented).toBe(true);
    expect(root.getExposes().getSelectedKeys()).toEqual([]);
  }
  expect(row.getAttribute('data-pui-a11y-actions')).toBe('activate');
  setElementProps(root, { rows, selectedKeys: [], readOnly: true });
  await flush();
  const down = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
  row.dispatchEvent(down);
  row.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
  await flush();
  expect(down.defaultPrevented).toBe(false);
  expect(changes).toHaveLength(2);
});
it('keeps the accepted request before subscriber retirement and rejects retained requests afterwards', async () => {
  const { root } = await fixture();
  const changes: unknown[] = [];
  root.addEventListener('selectionChange', (event: CustomEvent) => changes.push(event.detail));
  const api = root.getExposes();
  const state = api.pageSelection;
  const unsubscribe = state.subscribe(() => root.remove());
  api.requestPageSelection(true);
  await flush();
  unsubscribe();
  expect(root.isConnected).toBe(false);
  // External state notifications follow the accepted callback transaction;
  // DOM removal requested by that observer does not retroactively cancel it.
  expect(changes).toEqual([{ selectedKeys: ['a', 'b'] }]);
  expect(() => api.requestPageSelection(false)).toThrow(/terminal disposal/);
  expect(changes).toHaveLength(1);
});
