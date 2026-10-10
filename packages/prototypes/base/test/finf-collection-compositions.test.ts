import { it, expect } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { resizableRoot, resizablePanel, resizableHandle } from '../src/resizable';
import { carouselRoot, carouselViewport, carouselSlide, carouselNext } from '../src/carousel';
import { datePickerRoot, datePickerDay, datePickerValue } from '../src/date-picker';
import {
  dataTableRoot,
  dataTableRow,
  dataTableCell,
  dataTableHeader,
  dataView,
} from '../src/data-table';
const prototypes = [
  resizableRoot,
  resizablePanel,
  resizableHandle,
  carouselRoot,
  carouselViewport,
  carouselSlide,
  carouselNext,
  datePickerRoot,
  datePickerDay,
  datePickerValue,
  dataTableRoot,
  dataTableRow,
  dataTableCell,
  dataTableHeader,
];
for (const p of prototypes) AdaptToWebComponent(p, { registerAs: `test-${p.name}` });
const node = (name: string, props: Record<string, unknown> = {}) => {
  const el = document.createElement(`test-base-${name}`) as any;
  setElementProps(el, props);
  return el;
};
const flush = async () => {
  for (let n = 0; n < 20; n++) await Promise.resolve();
};
it('resizes actual panels with constrained ratio and honors readOnly requests', async () => {
  const root = node('resizable-root', { defaultValue: 35, min: 20, max: 80 }),
    left = node('resizable-panel', { index: 0 }),
    right = node('resizable-panel', { index: 1 }),
    handle = node('resizable-handle');
  root.append(left, handle, right);
  document.body.append(root);
  await flush();
  root.getExposes().requestValue(95, true);
  await flush();
  expect(left.getExposes().size.get()).toBe(80);
  expect(right.getExposes().size.get()).toBe(20);
  expect(handle.getAttribute('aria-valuenow')).toBe('80');
  expect(left.style.getPropertyValue('--pui-size')).toBe('80');
  expect(left.getAttribute('data-pui-style')).toContain('basis-[calc(var(--pui-size)*1%)]');
  left.remove();
  await flush();
  root.getExposes().requestValue(40);
  await flush();
  expect(left.style.getPropertyValue('--pui-size')).toBe('80');
  root.prepend(left);
  await flush();
  expect(left.style.getPropertyValue('--pui-size')).toBe('40');
  setElementProps(root, { readOnly: true });
  await flush();
  expect(root.getExposes().requestValue(25)).toBe(false);
  root.remove();
});
it('advances real slides and disables at the last boundary', async () => {
  const root = node('carousel-root'),
    viewport = node('carousel-viewport'),
    a = node('carousel-slide', { index: 0 }),
    b = node('carousel-slide', { index: 1 }),
    next = node('carousel-next');
  viewport.append(a, b);
  root.append(viewport, next);
  document.body.append(root);
  await flush();
  expect(a.getExposes().current.get()).toBe(true);
  next.click();
  await flush();
  expect(root.getExposes().index.get()).toBe(1);
  expect(b.getExposes().current.get()).toBe(true);
  expect(next.getExposes().disabled.get()).toBe(true);
  root.remove();
});
it('Date Picker composes Calendar selection with Popover close', async () => {
  const root = node('date-picker-root', { defaultMonth: '2026-10', defaultOpen: true }),
    day = node('date-picker-day', { date: '2026-10-12' }),
    value = node('date-picker-value');
  root.append(day, value);
  document.body.append(root);
  await flush();
  day.click();
  await flush();
  expect(root.getExposes().value.get()).toBe('2026-10-12');
  expect(root.getExposes().open.get()).toBe(false);
  expect(value.getExposes().displayValue.get()).toBe('2026-10-12');
  root.remove();
});
it('sorts, filters and paginates data with stable input tie order', () => {
  const rows = [
    { id: 'a', name: 'Alpha', score: 3 },
    { id: 'b', name: 'Beta', score: 1 },
    { id: 'c', name: 'Gamma', score: 1 },
  ];
  expect(
    dataView(rows, { sortKey: 'score', sortDirection: 'ascending', pageSize: 2 }).rows.map(
      (r) => r.id
    )
  ).toEqual(['b', 'c']);
  expect(dataView(rows, { filter: 'Alpha' }).rows.map((r) => r.id)).toEqual(['a']);
  expect(dataView(rows, { page: 1, pageSize: 2 }).rows.map((r) => r.id)).toEqual(['c']);
});
it('updates actual passive Table cells when a sort control is activated', async () => {
  const root = node('data-table-root', {
      rows: [
        { id: 'a', name: 'Zeta' },
        { id: 'b', name: 'Alpha' },
      ],
      pageSize: 2,
    }),
    head = node('data-table-row', { header: true }),
    header = node('data-table-header', { headerKey: 'name', headerKind: 'column' }),
    row0 = node('data-table-row', { index: 0 }),
    row1 = node('data-table-row', { index: 1 }),
    cell0 = node('data-table-cell', { columnKey: 'name', headers: ['name'] }),
    cell1 = node('data-table-cell', { columnKey: 'name', headers: ['name'] });
  header.textContent = 'Name';
  head.append(header);
  row0.append(cell0);
  row1.append(cell1);
  root.append(head, row0, row1);
  document.body.append(root);
  await flush();
  expect(cell0.getExposes().displayValue.get()).toBe('Zeta');
  header.click();
  await flush();
  expect(cell0.getExposes().displayValue.get()).toBe('Alpha');
  expect(header.getAttribute('aria-sort')).toBe('ascending');
  expect(row0.getExposes().rowKey.get()).toBe('b');
  row0.click();
  await flush();
  expect(row0.getExposes().selected.get()).toBe(true);
  expect(root.getExposes().getStructure()?.valid).toBe(true);
  root.remove();
});

import { collectProtoStyleTokens } from '../../../cli/src/services/prototype-style-tokens';
import {
  renderProtoStyleTokenCss,
  renderProtoShadowStyleTokenCss,
} from '../../../cli/src/services/proto-style-css';
import path from 'node:path';
it('collects and compiles one continuous panel ratio recipe', async () => {
  const tokens = await collectProtoStyleTokens(
    path.resolve(process.cwd(), 'packages/prototypes/base/src/resizable')
  );
  expect(tokens).toContain('basis-[calc(var(--pui-size)*1%)]');
  const recipe = ['basis-[calc(var(--pui-size)*1%)]', 'basis-2'];
  for (const css of [renderProtoStyleTokenCss(recipe), renderProtoShadowStyleTokenCss(recipe)]) {
    expect(css).not.toContain('Unsupported Proto UI style tokens');
    expect(css).toContain('flex-basis: calc(var(--pui-size)*1%);');
    expect(css).toContain('flex-basis: 0.5rem;');
  }
});
