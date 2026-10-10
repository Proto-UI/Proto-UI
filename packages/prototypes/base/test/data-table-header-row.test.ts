import { afterEach, describe, expect, it } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import * as base from '../src/data-table';
import * as shadcn from '../../shadcn/src/data-table';
import * as brutalist from '../../brutalist/src/data-table';
import * as bootstrap from '../../bootstrap-2-3-2/src/data-table';
import * as liquid from '../../liquid-glass/src/data-table';
const families = { base, shadcn, brutalist, bootstrap, liquid };
const tags = new Map<object, string>();
let disposed = 0;
for (const family of Object.values(families)) {
  for (const proto of [
    family.dataTableRoot,
    family.dataTableRow,
    family.dataTableCell,
    family.dataTableHeader,
    family.dataTableHeaderRow,
    family.dataTableCaption,
  ]) {
    const tag = `header-row-test-${proto.name}`;
    tags.set(proto, tag);
    AdaptToWebComponent(proto, {
      registerAs: tag,
      diagnostics: {
        onLifecycleEvent(event) {
          if (event.type === 'instance.dispose.done') disposed++;
        },
      },
    });
  }
}
const rows = [
  { id: 'a', name: 'Zeta', requests: 3 },
  { id: 'b', name: 'Alpha', requests: 9 },
];
const node = (proto: object, props: Record<string, unknown> = {}) => {
  const el = document.createElement(tags.get(proto)!) as HTMLElement & { getExposes(): any };
  setElementProps(el, props);
  return el;
};
const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});
type Family = Pick<
  typeof base,
  'dataTableRoot' | 'dataTableRow' | 'dataTableCell' | 'dataTableHeader' | 'dataTableHeaderRow'
>;
function fixture(
  family: Family = base,
  props: Record<string, unknown> = {},
  headerProto: object = family.dataTableHeaderRow
) {
  const root = node(family.dataTableRoot, { rows, pageSize: 2, ...props });
  const head = node(headerProto);
  const headers = ['name', 'requests'].map((headerKey) => {
    const el = node(family.dataTableHeader, { headerKey, headerKind: 'column' });
    el.textContent = headerKey;
    return el;
  });
  head.append(...headers);
  const body = [0, 1].map((index) => {
    const row = node(family.dataTableRow, { index });
    for (const columnKey of ['name', 'requests'])
      row.append(node(family.dataTableCell, { columnKey, headers: [columnKey] }));
    return row;
  });
  root.append(head, ...body);
  document.body.append(root);
  const requests: Array<{ sortKey: string; sortDirection: string }> = [];
  const selections: unknown[] = [];
  root.addEventListener('sortChange', (event) => requests.push((event as CustomEvent).detail));
  root.addEventListener('selectionChange', (event) =>
    selections.push((event as CustomEvent).detail)
  );
  return { root, head, headers, body, requests, selections };
}
for (const [name, family] of Object.entries(families))
  describe(name, () => {
    it('mounts two independent sorting headers with passive topology and no data-slot count', async () => {
      const f = fixture(family);
      await flush();
      const structure = f.root.getExposes().getStructure();
      expect(structure).toMatchObject({ valid: true, rowCount: 3, columnCount: 2 });
      expect(f.root.getAttribute('role')).toBe('table');
      expect(f.head.getAttribute('role')).toBe('row');
      expect(f.root.getExposes().count.get()).toBe(2);
      expect(Object.keys(f.head.getExposes())).toEqual([]);
      expect(f.head.tabIndex).toBe(-1);
      expect(f.head.getAttribute('aria-selected')).toBeNull();
      const staticRecipe = f.head.getAttribute('data-pui-style');
      const bodyStaticTokens = (f.body[0]!.getAttribute('data-pui-style') ?? '')
        .split(/\s+/)
        .filter((token) => !/^data-\[(focus-visible|selected)\]:/.test(token))
        .filter(Boolean);
      expect((staticRecipe ?? '').split(/\s+/).filter(Boolean)).toEqual(bodyStaticTokens);
      expect(staticRecipe ?? '').not.toMatch(/data-\[(focus-visible|selected)\]:/);
      expect(structure.rows[1].cells[0].columnHeaders).toEqual([structure.rows[0].cells[0].ref]);
      expect(structure.rows[1].cells[1].columnHeaders).toEqual([structure.rows[0].cells[1].ref]);
      f.head.click();
      f.head.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      f.head.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
      await flush();
      expect(f.requests).toEqual([]);
      expect(f.selections).toEqual([]);
      f.headers[0]!.click();
      await flush();
      expect(f.requests).toEqual([{ sortKey: 'name', sortDirection: 'ascending' }]);
      expect(f.headers[0]!.getAttribute('aria-sort')).toBe('ascending');
      expect(
        f.root
          .getExposes()
          .getRows()
          .map((r: { id: string }) => r.id)
      ).toEqual(['b', 'a']);
      for (const key of ['Enter', ' ']) {
        const before = f.requests.length;
        f.headers[1]!.focus();
        f.headers[1]!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        f.headers[1]!.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
        await flush();
        expect(f.requests).toHaveLength(before + 1);
        expect(f.requests.at(-1)?.sortKey).toBe('requests');
      }
      expect(f.selections).toEqual([]);
      f.body[0]!.click();
      await flush();
      expect(f.selections).toHaveLength(1);
      expect(f.body[0]!.getExposes().selected.get()).toBe(true);
      expect(f.head.getAttribute('data-pui-style')).toBe(staticRecipe);
      expect(Object.keys(f.head.getExposes())).toEqual([]);
    });
  });
it('preserves controlled sort refusal then accepts owner-provided canonical values', async () => {
  const f = fixture(base, { sortKey: '', sortDirection: 'none' });
  await flush();
  f.headers[0]!.click();
  await flush();
  expect(f.requests).toEqual([{ sortKey: 'name', sortDirection: 'ascending' }]);
  expect(f.headers[0]!.getAttribute('aria-sort')).toBe('none');
  expect(
    f.root
      .getExposes()
      .getRows()
      .map((r: { id: string }) => r.id)
  ).toEqual(['a', 'b']);
  f.root.addEventListener('sortChange', (event) =>
    setElementProps(f.root, { rows, pageSize: 2, ...(event as CustomEvent).detail })
  );
  f.headers[1]!.click();
  await flush();
  expect(f.requests).toHaveLength(2);
  expect(f.headers[1]!.getAttribute('aria-sort')).toBe('ascending');
  setElementProps(f.root, { rows, pageSize: 2, sortKey: 'name', sortDirection: 'ascending' });
  await flush();
  expect(f.headers[0]!.getAttribute('aria-sort')).toBe('ascending');
  expect(
    f.root
      .getExposes()
      .getRows()
      .map((r: { id: string }) => r.id)
  ).toEqual(['b', 'a']);
});
it('keeps disabled sorting blocked and existing readOnly row-selection policy unchanged', async () => {
  const f = fixture(base, { disabled: true });
  await flush();
  f.headers[0]!.click();
  await flush();
  expect(f.requests).toEqual([]);
  expect(f.headers[0]!.tabIndex).toBe(-1);
  setElementProps(f.root, { rows, pageSize: 2, readOnly: true });
  await flush();
  f.headers[0]!.click();
  f.body[0]!.click();
  await flush();
  expect(f.requests).toHaveLength(1);
  expect(f.selections).toEqual([]);
});
it('releases and rebinds the passive structure without changing data slots or acquiring activation', async () => {
  const f = fixture();
  await flush();
  const before = disposed;
  f.head.remove();
  await expect.poll(() => disposed).toBeGreaterThan(before);
  expect(f.root.getExposes().getStructure().valid).toBe(false);
  expect(f.root.getExposes().count.get()).toBe(2);
  f.root.prepend(f.head);
  await flush();
  expect(f.root.getExposes().getStructure()).toMatchObject({ valid: true, rowCount: 3 });
  expect(f.head.getAttribute('role')).toBe('row');
  expect(f.head.tabIndex).toBe(-1);
  f.headers[1]!.click();
  await flush();
  expect(f.requests).toHaveLength(1);
  f.headers[0]!.remove();
  f.head.append(f.headers[0]!);
  await flush();
  expect(f.root.getExposes().getStructure().rows[0].cells[0].ref).toBe(
    f.root.getExposes().getStructure().rows[1].cells[1].columnHeaders[0]
  );
  expect(f.root.getExposes().count.get()).toBe(2);
});
it('exposes no authored state or Button child while preserving the inherited slot render', async () => {
  let captured: ReturnType<typeof base.asDataTableHeaderRow> | undefined;
  const proto = definePrototype<base.DataTableHeaderRowProps, base.DataTableHeaderRowExposes>({
    name: 'header-row-capture',
    setup() {
      captured = base.asDataTableHeaderRow();
      return captured.render;
    },
  });
  tags.set(proto, proto.name);
  AdaptToWebComponent(proto);
  const f = fixture(base, {}, proto);
  await flush();
  expect(captured).toBeDefined();
  expect(Object.keys(captured!.stateHandles ?? {})).toEqual([]);
  expect(typeof captured!.getAsHookHandle).toBe('function');
  expect(captured!.getAsHookHandle?.('as-button')).toBeUndefined();
  expect(f.head.textContent).toBe('namerequests');
  expect(f.root.getExposes().getStructure().valid).toBe(true);
});
it('retains legacy dynamic header policy and its diagnostic for two direct Trigger children', async () => {
  const root = node(base.dataTableRoot, { rows, pageSize: 2, defaultSelectedKeys: ['a'] });
  const legacy = node(base.dataTableRow, { header: true });
  const first = node(base.dataTableHeader, { headerKey: 'name' });
  const second = node(base.dataTableHeader, { headerKey: 'requests' });
  legacy.append(first);
  root.append(legacy);
  document.body.append(root);
  await flush();
  expect(legacy.getExposes().rowKey.get()).toBe('');
  setElementProps(legacy, { header: false });
  await flush();
  expect(legacy.getExposes().rowKey.get()).toBe('a');
  expect(legacy.getExposes().selected.get()).toBe(true);
  setElementProps(legacy, { header: true });
  await flush();
  expect(legacy.getExposes().rowKey.get()).toBe('');
  expect(legacy.getExposes().selected.get()).toBe(false);
  expect(legacy.tabIndex).toBe(-1);
  expect(() => legacy.append(second)).toThrow(/continuous chain.*sibling Trigger/);
});
import baseDemo from '../../../../apps/www/src/content/docs/zh-cn/demo-base-data-table.demo';
import shadcnDemo from '../../../../apps/www/src/content/docs/zh-cn/demo-shadcn-data-table.demo';
import brutalistDemo from '../../../../apps/www/src/content/docs/zh-cn/demo-brutalist-data-table.demo';
import bootstrapDemo from '../../../../apps/www/src/content/docs/zh-cn/demo-bootstrap-2-3-2-data-table.demo';
import liquidDemo from '../../../../apps/www/src/content/docs/zh-cn/demo-liquid-glass-data-table.demo';
const demos = [baseDemo, shadcnDemo, brutalistDemo, bootstrapDemo, liquidDemo];
for (const [index, family] of Object.values(families).entries())
  it(`materializes migrated ${family.dataTableRoot.name} DemoSpec using exact local exports`, async () => {
    const protos = new Map(
      [
        family.dataTableRoot,
        family.dataTableRow,
        family.dataTableHeaderRow,
        family.dataTableHeader,
        family.dataTableCell,
        family.dataTableCaption,
      ].map((proto) => [proto.name, proto])
    );
    // This checks authored source/local exports; shared Previewer/CLI registration
    // is integrated and tested by its separate owner, not simulated here.
    const render = (spec: any): Node => {
      if (typeof spec === 'string') return document.createTextNode(spec);
      const proto = protos.get(spec.prototypeId);
      if (!proto) throw new Error(`Missing exact local prototype ${spec.prototypeId}`);
      const element = node(proto, spec.props ?? {});
      for (const child of spec.children ?? []) element.append(render(child));
      return element;
    };
    const root = render(demos[index]!.root) as HTMLElement & { getExposes(): any };
    document.body.append(root);
    await flush();
    expect(root.getExposes().getStructure()).toMatchObject({
      valid: true,
      rowCount: 4,
      columnCount: 2,
    });
    expect(root.getExposes().count.get()).toBe(3);
    const headerRow = root.querySelector(tags.get(family.dataTableHeaderRow)!)!;
    expect(headerRow.getAttribute('role')).toBe('row');
    expect(headerRow.querySelectorAll(tags.get(family.dataTableHeader)!)).toHaveLength(2);
  });
